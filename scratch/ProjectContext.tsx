import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { addMonths, format } from 'date-fns';
import { generateActionsOnStatusChange, generateActionsOnTaskCompletion, createDynamicAction } from '../utils/actionRules';
import type { Project, NextAction, ProjectStatus, ActionPriority } from '../types';
import { useWorkflow } from './WorkflowContext';
import { useRules } from './RuleContext';
import { useAuth } from './AuthContext';

interface ProjectContextType {
  projects: Project[];
  actions: NextAction[];
  handleStatusChange: (projectId: string, newStatus: ProjectStatus) => void;
  handleCompleteAction: (actionId: string) => void;
  addProject: (newProject: Project, initialAction?: NextAction) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  renameProjectStatus: (oldStatus: string, newStatus: string) => void;
  postponeAction: (actionId: string, days: number) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [actions, setActions] = useState<NextAction[]>([]);
  const { getRulesForStatus, kanbanColumns } = useWorkflow();
  const { rules } = useRules();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const fetchProjects = async () => {
      const { data, error } = await supabase.from('projects').select('*');
      if (error) {
        console.error('Error fetching projects:', error);
      } else if (data) {
        // Convert snake_case to camelCase
        const formattedProjects = data.map(p => ({
          id: p.id,
          clinicName: p.clinic_name,
          clinicType: '',
          address: '',
          phone: '',
          email: '',
          contactPerson: '',
          contactTitle: '',
          source: '',
          receivedAt: p.created_at,
          product: '',
          quantity: 1,
          priority: '中' as ActionPriority,
          status: p.status,
          phase: p.phase,
          salesRep: p.sales_rep,
          ballHolder: p.ball_holder,
          lastActivityAt: p.last_activity_at,
          probability: p.probability as any,
          memo: p.memo,
          isImplementationProject: p.is_implementation_project,
          pipelineMap: {
            deviceType: p.device_type,
            bodyColor: p.body_color,
            subsidyName: p.subsidy_name,
            creditStatus: p.credit_status,
            emoneyStatus: p.emoney_status,
            qrStatus: p.qr_status,
          },
          installationDate: p.installation_date,
          createdAt: p.created_at,
          updatedAt: p.created_at,
        }));
        setProjects(formattedProjects);
      }
    };
    
    const fetchActions = async () => {
      const { data, error } = await supabase.from('actions').select('*');
      if (error) {
        console.error('Error fetching actions:', error);
      } else if (data) {
        const formattedActions = data.map(a => ({
          id: a.id,
          projectId: a.project_id,
          title: a.title,
          status: a.status,
          deadline: a.deadline,
          assignee: a.assignee,
          priority: a.priority,
          memo: a.memo,
          completedAt: a.completed_at,
          createdAt: a.created_at
        }));
        setActions(formattedActions);
      }
    };

    fetchProjects();
    fetchActions();
  }, [user]);

  const handleStatusChange = (projectId: string, newStatus: ProjectStatus) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    if (project.status === newStatus) return; // 変更なし

    let updatedActions = actions;
    let nextBallHolder = project.ballHolder;
    let generatedTitles: string[] = [];

    // 1. 動的ルール（WorkflowContext）の適用
    const dynamicRules = getRulesForStatus(newStatus);
    const enterRules = dynamicRules.filter(r => r.trigger === '進入時');
    
    if (enterRules.length > 0) {
      const dynamicActions = enterRules.map(r => createDynamicAction(project, r));
      updatedActions = [...updatedActions, ...dynamicActions];
      generatedTitles.push(...dynamicActions.map(a => a.title));
      // ボール保持者の更新は簡易的に営業とする
      nextBallHolder = project.salesRep;
    }

    // 2. グローバルルールの適用
    const result = generateActionsOnStatusChange(project, newStatus, rules);
    if (result) {
      updatedActions = [...updatedActions, ...result.newActions];
      nextBallHolder = result.nextBallHolder;
      alert(`「${project.clinicName}」のステータスが「${newStatus}」に変更され、自動的に「${result.newActions.map(a => a.title).join('、')}」が生成されました。`);
    } else {
      if (newStatus !== '失注') {
        alert(`ステータスを「${newStatus}」に変更しました。`);
      }
    }

    // 3. 失注時の半年後フォローアップ自動生成
    if (newStatus === '失注') {
      const followupDate = format(addMonths(new Date(), 6), 'yyyy-MM-dd');
      const followupAction: NextAction = {
        id: uuidv4(),
        projectId: project.id,
        title: '状況伺い（失注後フォローアップ）',
        assignee: project.salesRep,
        deadline: followupDate,
        priority: '低',
        status: '未完了',
        memo: '失注から半年経過。現在の状況や別件のニーズがないか確認する。',
        createdAt: new Date().toISOString()
      };
      updatedActions = [...updatedActions, followupAction];
      alert(`失注として記録し、半年後（${followupDate}）のフォローアップタスクを自動生成しました。`);
    }

    setActions(updatedActions);
    const newColumn = kanbanColumns.find(c => c.id === newStatus);
    const newIsImplementation = newColumn?.phase === 'implementation' ? true : project.isImplementationProject;

    setProjects(projects.map(p => 
      p.id === project.id ? { 
        ...p, 
        status: newStatus, 
        ballHolder: nextBallHolder, 
        isImplementationProject: newIsImplementation,
        lastActivityAt: new Date().toISOString() 
      } : p
    ));
  };

  const handleCompleteAction = (actionId: string) => {
    const action = actions.find(a => a.id === actionId);
    if (!action) return;
    const project = projects.find(p => p.id === action.projectId);
    if (!project) return;

    let updatedActions = actions.map(a => 
      a.id === actionId ? { ...a, status: '完了' as const, completedAt: new Date().toISOString() } : a
    );
    let nextBallHolder = project.ballHolder;

    const result = generateActionsOnTaskCompletion(project, action.title, rules);
    if (result) {
      updatedActions = [...updatedActions, ...result.newActions];
      nextBallHolder = result.nextBallHolder;
      alert(`「${action.title}」を完了し、自動的に「${result.newActions.map(a => a.title).join('、')}」を生成しました。`);
    } else {
      alert(`「${action.title}」を完了しました。`);
    }

    setActions(updatedActions);
    setProjects(projects.map(p => 
      p.id === project.id ? { ...p, ballHolder: nextBallHolder, lastActivityAt: new Date().toISOString() } : p
    ));
  };

  const addProject = (newProject: Project, initialAction?: NextAction) => {
    let newActions: NextAction[] = [];
    let nextBallHolder = newProject.ballHolder;
    
    // 1. 動的ルールの適用
    const dynamicRules = getRulesForStatus(newProject.status);
    const enterRules = dynamicRules.filter(r => r.trigger === '進入時');
    
    if (enterRules.length > 0) {
      newActions = enterRules.map(r => createDynamicAction(newProject, r));
      nextBallHolder = newProject.salesRep;
    } else {
      // 2. グローバルルールの適用
      const result = generateActionsOnStatusChange(newProject, newProject.status, rules);
      if (result) {
        newActions = result.newActions;
        nextBallHolder = result.nextBallHolder;
      } else if (initialAction) {
        newActions = [initialAction];
      }
    }

    const finalProject = { ...newProject, ballHolder: nextBallHolder };
    
    setProjects(prev => [finalProject, ...prev]);
    setActions(prev => [...newActions, ...prev]);
  };

  const renameProjectStatus = (oldStatus: string, newStatus: string) => {
    setProjects(prev => prev.map(p => 
      p.status === oldStatus ? { ...p, status: newStatus } : p
    ));
  };

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    ));
  };

  const postponeAction = (actionId: string, days: number) => {
    setActions(actions.map(a => {
      if (a.id === actionId) {
        const currentDeadline = new Date(a.deadline);
        currentDeadline.setDate(currentDeadline.getDate() + days);
        const yyyy = currentDeadline.getFullYear();
        const mm = String(currentDeadline.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDeadline.getDate()).padStart(2, '0');
        return { ...a, deadline: `${yyyy}-${mm}-${dd}` };
      }
      return a;
    }));
  };

  return (
    <ProjectContext.Provider value={{ projects, actions, handleStatusChange, handleCompleteAction, addProject, updateProject, renameProjectStatus, postponeAction }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
}

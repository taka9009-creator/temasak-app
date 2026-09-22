import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot, 
  writeBatch 
} from 'firebase/firestore';
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
    if (!user) {
      setProjects([]);
      setActions([]);
      return;
    }

    // Projects Firestore Realtime Listener
    const projectsQuery = query(collection(db, 'projects'), where('user_id', '==', user.id));
    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      const loadedProjects: Project[] = snapshot.docs.map(docSnap => {
        const p = docSnap.data();
        return {
          id: docSnap.id,
          clinicName: p.clinic_name || '',
          clinicType: '',
          address: '',
          phone: '',
          email: '',
          contactPerson: '',
          contactTitle: '',
          source: '',
          receivedAt: p.created_at || new Date().toISOString(),
          product: '',
          quantity: 1,
          priority: '中' as ActionPriority,
          status: p.status || '新規',
          salesRep: p.sales_rep || '',
          ballHolder: p.ball_holder || '',
          lastActivityAt: p.last_activity_at || p.created_at || new Date().toISOString(),
          probability: p.probability as any,
          memo: p.memo || '',
          isImplementationProject: !!p.is_implementation_project,
          pipelineMap: {
            deviceType: p.device_type,
            bodyColor: p.body_color,
            subsidyName: p.subsidy_name,
            creditStatus: p.credit_status,
            emoneyStatus: p.emoney_status,
            qrStatus: p.qr_status,
          },
          installationDate: p.installation_date,
          createdAt: p.created_at || new Date().toISOString(),
          updatedAt: p.updated_at || new Date().toISOString(),
        };
      });
      setProjects(loadedProjects);
    }, (error) => {
      console.error('Firestore projects error:', error);
    });

    // Actions Firestore Realtime Listener
    const actionsQuery = query(collection(db, 'actions'), where('user_id', '==', user.id));
    const unsubscribeActions = onSnapshot(actionsQuery, (snapshot) => {
      const loadedActions: NextAction[] = snapshot.docs.map(docSnap => {
        const a = docSnap.data();
        return {
          id: docSnap.id,
          projectId: a.project_id || '',
          title: a.title || '',
          status: a.status || '未完了',
          deadline: a.deadline || '',
          assignee: a.assignee || '',
          priority: a.priority || '中',
          memo: a.memo || '',
          completedAt: a.completed_at,
          createdAt: a.created_at || new Date().toISOString()
        };
      });
      setActions(loadedActions);
    }, (error) => {
      console.error('Firestore actions error:', error);
    });

    return () => {
      unsubscribeProjects();
      unsubscribeActions();
    };
  }, [user]);

  const handleStatusChange = async (projectId: string, newStatus: ProjectStatus) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    if (project.status === newStatus) return;

    let updatedActions = actions;
    let nextBallHolder = project.ballHolder;
    let generatedTitles: string[] = [];
    let newActionsToInsert: NextAction[] = [];

    // 1. 動的ルールの適用
    const dynamicRules = getRulesForStatus(newStatus);
    const enterRules = dynamicRules.filter(r => r.trigger === '進入時');
    
    if (enterRules.length > 0) {
      const dynamicActions = enterRules.map(r => createDynamicAction(project, r));
      newActionsToInsert = [...newActionsToInsert, ...dynamicActions];
      generatedTitles.push(...dynamicActions.map(a => a.title));
      nextBallHolder = project.salesRep;
    }

    // 2. グローバルルールの適用
    const result = generateActionsOnStatusChange(project, newStatus, rules);
    if (result) {
      newActionsToInsert = [...newActionsToInsert, ...result.newActions];
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
      newActionsToInsert = [...newActionsToInsert, followupAction];
      alert(`失注として記録し、半年後（${followupDate}）のフォローアップタスクを自動生成しました。`);
    }

    updatedActions = [...updatedActions, ...newActionsToInsert];
    
    const newColumn = kanbanColumns.find(c => c.id === newStatus);
    const newIsImplementation = newColumn?.phase === 'implementation' ? true : project.isImplementationProject;
    const nowIso = new Date().toISOString();

    if (user) {
      try {
        const projectRef = doc(db, 'projects', project.id);
        await updateDoc(projectRef, { 
          status: newStatus,
          ball_holder: nextBallHolder,
          is_implementation_project: newIsImplementation,
          last_activity_at: nowIso,
          updated_at: nowIso
        });

        if (newActionsToInsert.length > 0) {
          const batch = writeBatch(db);
          newActionsToInsert.forEach(a => {
            const actionRef = doc(db, 'actions', a.id);
            batch.set(actionRef, {
              id: a.id,
              project_id: a.projectId,
              title: a.title,
              status: a.status,
              deadline: a.deadline,
              assignee: a.assignee,
              priority: a.priority,
              memo: a.memo,
              user_id: user.id,
              created_at: a.createdAt || nowIso
            });
          });
          await batch.commit();
        }
      } catch (e: any) {
        console.error('Error updating project status in Firestore:', e);
      }
    }

    setActions(updatedActions);
    setProjects(projects.map(p => 
      p.id === project.id ? { 
        ...p, 
        status: newStatus, 
        ballHolder: nextBallHolder, 
        isImplementationProject: newIsImplementation,
        lastActivityAt: nowIso 
      } : p
    ));
  };

  const handleCompleteAction = async (actionId: string) => {
    const action = actions.find(a => a.id === actionId);
    if (!action) return;
    const project = projects.find(p => p.id === action.projectId);
    if (!project) return;

    const completedAtIso = new Date().toISOString();
    let updatedActions = actions.map(a => 
      a.id === actionId ? { ...a, status: '完了' as const, completedAt: completedAtIso } : a
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

    if (user) {
      try {
        // 1. タスク完了
        const actionRef = doc(db, 'actions', actionId);
        await updateDoc(actionRef, { status: '完了', completed_at: completedAtIso });
        
        // 2. プロジェクト更新
        const projectRef = doc(db, 'projects', project.id);
        await updateDoc(projectRef, { ball_holder: nextBallHolder, last_activity_at: completedAtIso });
        
        // 3. 新規アクション追加
        if (result && result.newActions.length > 0) {
          const batch = writeBatch(db);
          result.newActions.forEach(a => {
            const newActRef = doc(db, 'actions', a.id);
            batch.set(newActRef, {
              id: a.id,
              project_id: a.projectId,
              title: a.title,
              status: a.status,
              deadline: a.deadline,
              assignee: a.assignee,
              priority: a.priority,
              memo: a.memo,
              user_id: user.id,
              created_at: a.createdAt || completedAtIso
            });
          });
          await batch.commit();
        }
      } catch (e: any) {
        console.error('Error completing action in Firestore:', e);
      }
    }

    setActions(updatedActions);
    setProjects(projects.map(p => 
      p.id === project.id ? { ...p, ballHolder: nextBallHolder, lastActivityAt: completedAtIso } : p
    ));
  };

  const addProject = async (newProject: Project, initialAction?: NextAction) => {
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
      }
    }

    if (initialAction) {
      newActions = [initialAction, ...newActions.filter(a => a.title !== initialAction.title)];
      nextBallHolder = initialAction.assignee || newProject.salesRep;
    }

    const finalProject = { ...newProject, ballHolder: nextBallHolder };
    
    if (user) {
      try {
        const dbProject: Record<string, any> = {
          id: finalProject.id,
          clinic_name: finalProject.clinicName || '',
          status: finalProject.status || '新規',
          phase: 'sales',
          sales_rep: finalProject.salesRep || '',
          ball_holder: finalProject.ballHolder || '',
          probability: finalProject.probability || 'B',
          memo: finalProject.memo || '',
          is_implementation_project: !!finalProject.isImplementationProject,
          device_type: finalProject.pipelineMap?.deviceType || '',
          body_color: finalProject.pipelineMap?.bodyColor || '',
          subsidy_name: finalProject.pipelineMap?.subsidyName || '',
          credit_status: finalProject.pipelineMap?.creditStatus || '',
          emoney_status: finalProject.pipelineMap?.emoneyStatus || '',
          qr_status: finalProject.pipelineMap?.qrStatus || '',
          installation_date: finalProject.installationDate || '',
          created_at: finalProject.createdAt || new Date().toISOString(),
          updated_at: finalProject.updatedAt || new Date().toISOString(),
          user_id: user.id
        };

        const projectRef = doc(db, 'projects', finalProject.id);
        await setDoc(projectRef, dbProject);

        if (newActions.length > 0) {
          const batch = writeBatch(db);
          newActions.forEach(a => {
            const actionRef = doc(db, 'actions', a.id);
            batch.set(actionRef, {
              id: a.id,
              project_id: a.projectId || finalProject.id,
              title: a.title || '',
              status: a.status || '未完了',
              deadline: a.deadline || '',
              assignee: a.assignee || '',
              priority: a.priority || '中',
              memo: a.memo || '',
              user_id: user.id,
              created_at: a.createdAt || new Date().toISOString()
            });
          });
          await batch.commit();
        }
      } catch (projectError: any) {
        console.error('Firebase Project Insert Error:', projectError);
        alert("データベースへの保存に失敗しました: " + projectError.message);
      }
    }

    setProjects(prev => [finalProject, ...prev]);
    setActions(prev => [...newActions, ...prev]);
  };

  const renameProjectStatus = async (oldStatus: string, newStatus: string) => {
    if (user) {
      try {
        const batch = writeBatch(db);
        projects.filter(p => p.status === oldStatus).forEach(p => {
          const ref = doc(db, 'projects', p.id);
          batch.update(ref, { status: newStatus, updated_at: new Date().toISOString() });
        });
        await batch.commit();
      } catch (e) {
        console.error('Error renaming status in Firestore:', e);
      }
    }
    setProjects(prev => prev.map(p => 
      p.status === oldStatus ? { ...p, status: newStatus } : p
    ));
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    if (user) {
      try {
        const dbUpdates: any = {
          updated_at: new Date().toISOString()
        };
        if (updates.clinicName !== undefined) dbUpdates.clinic_name = updates.clinicName;
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.salesRep !== undefined) dbUpdates.sales_rep = updates.salesRep;
        if (updates.ballHolder !== undefined) dbUpdates.ball_holder = updates.ballHolder;
        if (updates.probability !== undefined) dbUpdates.probability = updates.probability;
        if (updates.memo !== undefined) dbUpdates.memo = updates.memo;
        if (updates.isImplementationProject !== undefined) dbUpdates.is_implementation_project = updates.isImplementationProject;
        
        if (updates.pipelineMap) {
          if (updates.pipelineMap.deviceType !== undefined) dbUpdates.device_type = updates.pipelineMap.deviceType;
          if (updates.pipelineMap.bodyColor !== undefined) dbUpdates.body_color = updates.pipelineMap.bodyColor;
          if (updates.pipelineMap.subsidyName !== undefined) dbUpdates.subsidy_name = updates.pipelineMap.subsidyName;
          if (updates.pipelineMap.creditStatus !== undefined) dbUpdates.credit_status = updates.pipelineMap.creditStatus;
          if (updates.pipelineMap.emoneyStatus !== undefined) dbUpdates.emoney_status = updates.pipelineMap.emoneyStatus;
          if (updates.pipelineMap.qrStatus !== undefined) dbUpdates.qr_status = updates.pipelineMap.qrStatus;
        }
        
        if (updates.installationDate !== undefined) dbUpdates.installation_date = updates.installationDate;

        const projectRef = doc(db, 'projects', projectId);
        await updateDoc(projectRef, dbUpdates);
      } catch (e: any) {
        console.error('Error updating project in Firestore:', e);
      }
    }
    
    setProjects(prev => prev.map(p => 
      p.id === projectId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
    ));
  };

  const postponeAction = async (actionId: string, days: number) => {
    let newDeadlineStr = '';
    setActions(actions.map(a => {
      if (a.id === actionId) {
        const currentDeadline = new Date(a.deadline);
        currentDeadline.setDate(currentDeadline.getDate() + days);
        const yyyy = currentDeadline.getFullYear();
        const mm = String(currentDeadline.getMonth() + 1).padStart(2, '0');
        const dd = String(currentDeadline.getDate()).padStart(2, '0');
        newDeadlineStr = `${yyyy}-${mm}-${dd}`;
        return { ...a, deadline: newDeadlineStr };
      }
      return a;
    }));

    if (user && newDeadlineStr) {
      try {
        const actionRef = doc(db, 'actions', actionId);
        await updateDoc(actionRef, { deadline: newDeadlineStr });
      } catch (e: any) {
        console.error('Error postponing action in Firestore:', e);
      }
    }
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

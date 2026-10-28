import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { Branch } from '../types';
import { useAuth } from './AuthContext';

interface BranchContextType {
  branches: Branch[];
  currentBranch: Branch | null;
  switchBranch: (branchId: string) => void;
  loading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { staffProfile, role } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Branch[]>('/core/branches/')
      .then((res) => {
        const branchList = res.data;
        setBranches(branchList);

        // Select initial branch:
        // 1. If staff profile has assigned branch, prefer that
        // 2. Otherwise default to is_main_branch = True
        // 3. Otherwise first branch
        if (staffProfile?.branch_id) {
          const match = branchList.find((b) => b.id === staffProfile.branch_id);
          if (match) {
            setCurrentBranch(match);
            return;
          }
        }

        const main = branchList.find((b) => b.is_main_branch);
        setCurrentBranch(main || branchList[0] || null);
      })
      .catch((err) => {
        console.warn('Could not load branches from API, using fallback:', err);
        // Fallback default main branch
        const defaultBranch: Branch = {
          id: '00000000-0000-0000-0000-000000000001',
          hospital_id: '00000000-0000-0000-0000-000000000001',
          name: 'AURA Central Multi-Specialty Hospital',
          code: 'AURA-MAIN',
          address_line1: 'Plot 42, Health City Avenue, BKC',
          city: 'Mumbai',
          state: 'Maharashtra',
          postal_code: '400051',
          phone: '+91 22 2654 0100',
          is_main_branch: true,
          is_active: true,
        };
        setBranches([defaultBranch]);
        setCurrentBranch(defaultBranch);
      })
      .finally(() => setLoading(false));
  }, [staffProfile]);

  const switchBranch = (branchId: string) => {
    const selected = branches.find((b) => b.id === branchId);
    if (selected) {
      setCurrentBranch(selected);
    }
  };

  return (
    <BranchContext.Provider
      value={{
        branches,
        currentBranch,
        switchBranch,
        loading,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = (): BranchContextType => {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};

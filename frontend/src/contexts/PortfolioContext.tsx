import React, { createContext, useContext, ReactNode } from 'react';

interface PortfolioContextType {
  // Placeholder for portfolio context
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};

export const PortfolioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <PortfolioContext.Provider value={{}}>
      {children}
    </PortfolioContext.Provider>
  );
};

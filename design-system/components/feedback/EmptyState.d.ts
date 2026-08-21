import { ReactNode } from 'react';

export interface EmptyStateProps {
  title?: string;
  hint?: string;
  action?: ReactNode;
}
export declare function EmptyState(props: EmptyStateProps): JSX.Element;

import { ReactNode } from 'react';

export interface BadgeProps {
  tone?: 'principal' | 'secondaire' | 'success' | 'danger' | 'neutral';
  children?: ReactNode;
}
export declare function Badge(props: BadgeProps): JSX.Element;

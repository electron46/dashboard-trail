import { ReactNode } from 'react';

export interface MetricCardProps {
  label: string;
  value?: string | number;
  unit?: string;
  hint?: ReactNode;
  na?: boolean;
}
export declare function MetricCard(props: MetricCardProps): JSX.Element;

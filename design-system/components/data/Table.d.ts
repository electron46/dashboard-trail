import { ReactNode } from 'react';

export interface TableColumn {
  key: string;
  label: string;
  mono?: boolean;
  render?: (row: any) => ReactNode;
}
/**
 * @startingPoint section="Data" subtitle="Historique de séances — lignes cliquables" viewport="700x220"
 */
export interface TableProps {
  columns: TableColumn[];
  rows: any[];
  onRowClick?: (row: any) => void;
}
export declare function Table(props: TableProps): JSX.Element;

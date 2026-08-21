import { ReactNode } from 'react';

export interface DialogProps {
  open: boolean;
  title?: ReactNode;
  onClose?: () => void;
  children?: ReactNode;
}
export declare function Dialog(props: DialogProps): JSX.Element;

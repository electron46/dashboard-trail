import { ReactNode } from 'react';

export interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
}
export declare function Switch(props: SwitchProps): JSX.Element;

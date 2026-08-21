import { ReactNode } from 'react';

export interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;

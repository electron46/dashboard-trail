import { CSSProperties, ChangeEventHandler } from 'react';

export interface SelectOption { value: string; label: string; }
export interface SelectProps {
  value?: string;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  options?: (SelectOption | string)[];
  disabled?: boolean;
  style?: CSSProperties;
}
export declare function Select(props: SelectProps): JSX.Element;

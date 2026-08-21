import { CSSProperties, ChangeEventHandler } from 'react';

export interface InputProps {
  type?: 'text' | 'password' | 'date' | 'search';
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
  style?: CSSProperties;
}
export declare function Input(props: InputProps): JSX.Element;

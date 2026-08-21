import { ReactNode } from 'react';

export interface TagProps {
  children?: ReactNode;
  onRemove?: () => void;
}
export declare function Tag(props: TagProps): JSX.Element;

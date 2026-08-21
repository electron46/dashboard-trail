export interface TabItem { value: string; label: string; }
/**
 * @startingPoint section="Navigation" subtitle="Onglets pilule — mono, actif = anthracite plein" viewport="700x100"
 */
export interface TabsProps {
  items: TabItem[];
  active?: string;
  onChange?: (value: string) => void;
}
export declare function Tabs(props: TabsProps): JSX.Element;

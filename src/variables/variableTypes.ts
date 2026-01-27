export interface RstVariable {
  name: string;
  value?: string;
  kind: 'text' | 'image';
  source: string;
  imagePath?: string;
}


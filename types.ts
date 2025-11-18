
import type React from 'react';

export interface Tool {
  id: string;
  title: string;
  description: string;
  component: React.FC;
}

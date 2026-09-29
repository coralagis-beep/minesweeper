export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export interface Difficulty {
  id: string;
  name: string;
  rows: number;
  cols: number;
  mines: number;
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'classic', name: '經典 (10×10, 10雷)', rows: 10, cols: 10, mines: 10 },
  { id: 'beginner', name: '初級 (9×9, 10雷)', rows: 9, cols: 9, mines: 10 },
  { id: 'intermediate', name: '中級 (16×16, 40雷)', rows: 16, cols: 16, mines: 40 },
  { id: 'expert', name: '高級 (30×16, 99雷)', rows: 16, cols: 30, mines: 99 },
];

export interface CellData {
  r: number;
  c: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborCount: number;
  isExploded?: boolean;
  isWrongFlag?: boolean;
}

export interface BestScore {
  difficultyId: string;
  seconds: number;
  date: string;
}

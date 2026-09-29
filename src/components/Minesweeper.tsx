import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Flag, Shovel, RefreshCw, Trophy, HelpCircle, Settings } from 'lucide-react';
import { CellData, Difficulty, DIFFICULTIES, GameStatus } from '../types';
import { soundManager } from '../utils/audio';

export default function Minesweeper() {
  // Helper to create clean empty board matrix
  const createEmptyBoard = (difficulty: Difficulty): CellData[][] => {
    const { rows, cols } = difficulty;
    const newBoard: CellData[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: CellData[] = [];
      for (let c = 0; c < cols; c++) {
        row.push({
          r,
          c,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborCount: 0,
        });
      }
      newBoard.push(row);
    }
    return newBoard;
  };

  const [currentDifficulty, setCurrentDifficulty] = useState<Difficulty>(DIFFICULTIES[0]); // Default: 10x10, 10 mines
  const [board, setBoard] = useState<CellData[][]>(() => createEmptyBoard(DIFFICULTIES[0]));
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [flagsPlaced, setFlagsPlaced] = useState<number>(0);
  const [seconds, setSeconds] = useState<number>(0);
  const [isMouseDownOnBoard, setIsMouseDownOnBoard] = useState<boolean>(false);
  const [isFlagModeMobile, setIsFlagModeMobile] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [showScoreModal, setShowScoreModal] = useState<boolean>(false);
  const [bestScores, setBestScores] = useState<Record<string, number>>({});

  // Custom difficulty state
  const [customRows, setCustomRows] = useState<number>(10);
  const [customCols, setCustomCols] = useState<number>(10);
  const [customMines, setCustomMines] = useState<number>(10);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasMovedRef = useRef<boolean>(false);

  // Load best scores from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('minesweeper_best_scores');
      if (saved) {
        setBestScores(JSON.parse(saved));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Timer logic
  useEffect(() => {
    if (gameStatus === 'playing') {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => Math.min(prev + 1, 999));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameStatus]);

  // Sync sound manager enabled state
  useEffect(() => {
    soundManager.enabled = soundEnabled;
  }, [soundEnabled]);

  // Initialize board empty matrix
  const initBoard = useCallback((difficulty: Difficulty) => {
    setBoard(createEmptyBoard(difficulty));
    setGameStatus('idle');
    setFlagsPlaced(0);
    setSeconds(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Reset when difficulty changes
  useEffect(() => {
    initBoard(currentDifficulty);
  }, [currentDifficulty, initBoard]);

  // Count surrounding mines for a cell
  const countMinesAround = (b: CellData[][], r: number, c: number, rows: number, cols: number): number => {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && b[nr][nc].isMine) {
          count++;
        }
      }
    }
    return count;
  };

  // Place mines safely (first clicked cell (firstR, firstC) and its immediate neighbors are guaranteed not to be mines)
  const placeMinesAndStart = (firstR: number, firstC: number): CellData[][] => {
    const { rows, cols, mines: targetMines } = currentDifficulty;
    // Deep clone board
    const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));

    // Available spots excluding first clicked cell
    const safeRadius = 1;
    const availableCells: [number, number][] = [];
    const secondaryCells: [number, number][] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isNeighbor = Math.abs(r - firstR) <= safeRadius && Math.abs(c - firstC) <= safeRadius;
        if (r === firstR && c === firstC) {
          continue;
        } else if (isNeighbor) {
          secondaryCells.push([r, c]);
        } else {
          availableCells.push([r, c]);
        }
      }
    }

    // Shuffle availableCells
    for (let i = availableCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableCells[i], availableCells[j]] = [availableCells[j], availableCells[i]];
    }

    let placed = 0;
    // First fill from cells outside the 3x3 safe zone around first click
    while (placed < targetMines && availableCells.length > 0) {
      const [r, c] = availableCells.pop()!;
      newBoard[r][c].isMine = true;
      placed++;
    }

    // If more mines needed than outer cells (e.g. dense custom boards), use secondary cells
    if (placed < targetMines) {
      for (let i = secondaryCells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [secondaryCells[i], secondaryCells[j]] = [secondaryCells[j], secondaryCells[i]];
      }
      while (placed < targetMines && secondaryCells.length > 0) {
        const [r, c] = secondaryCells.pop()!;
        newBoard[r][c].isMine = true;
        placed++;
      }
    }

    // Calculate neighbor counts
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!newBoard[r][c].isMine) {
          newBoard[r][c].neighborCount = countMinesAround(newBoard, r, c, rows, cols);
        }
      }
    }

    return newBoard;
  };

  // Check victory condition
  const checkWin = (b: CellData[][]): boolean => {
    const { rows, cols, mines } = currentDifficulty;
    let revealed = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (b[r][c].isRevealed) {
          revealed++;
        }
      }
    }
    return revealed === rows * cols - mines;
  };

  // Recursive reveal empty cells (flood fill)
  const revealEmptyNeighbors = (b: CellData[][], startR: number, startC: number, rows: number, cols: number) => {
    const queue: [number, number][] = [[startR, startC]];
    while (queue.length > 0) {
      const [cr, cc] = queue.shift()!;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = cr + dr;
          const nc = cc + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const neighbor = b[nr][nc];
            if (!neighbor.isRevealed && !neighbor.isFlagged) {
              neighbor.isRevealed = true;
              if (neighbor.neighborCount === 0 && !neighbor.isMine) {
                queue.push([nr, nc]);
              }
            }
          }
        }
      }
    }
  };

  // Handle cell click (reveal)
  const handleCellClick = (r: number, c: number) => {
    if (gameStatus === 'won' || gameStatus === 'lost') return;

    // Mobile flag mode toggle
    if (isFlagModeMobile) {
      handleToggleFlag(r, c);
      return;
    }

    let activeBoard = board;
    const { rows, cols } = currentDifficulty;

    // First click setup
    if (gameStatus === 'idle') {
      activeBoard = placeMinesAndStart(r, c);
      setGameStatus('playing');
    }

    const target = activeBoard[r][c];
    if (target.isRevealed || target.isFlagged) return;

    const newBoard = activeBoard.map((row) => row.map((cell) => ({ ...cell })));
    const cell = newBoard[r][c];

    // Clicked a mine -> Game Over
    if (cell.isMine) {
      cell.isRevealed = true;
      cell.isExploded = true;
      soundManager.playExplosion();
      endGame(newBoard, false);
      return;
    }

    soundManager.playClick();
    cell.isRevealed = true;

    // If zero neighbor count, cascade reveal
    if (cell.neighborCount === 0) {
      revealEmptyNeighbors(newBoard, r, c, rows, cols);
    }

    // Check if player won
    if (checkWin(newBoard)) {
      endGame(newBoard, true);
    } else {
      setBoard(newBoard);
    }
  };

  // Handle chord / double click on revealed cell
  const handleChord = (r: number, c: number) => {
    if (gameStatus !== 'playing') return;
    const cell = board[r][c];
    if (!cell.isRevealed || cell.neighborCount === 0) return;

    const { rows, cols } = currentDifficulty;
    let flagsAround = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].isFlagged) {
          flagsAround++;
        }
      }
    }

    // If flagged neighbors match number, reveal all other unflagged neighbors
    if (flagsAround === cell.neighborCount) {
      const newBoard = board.map((row) => row.map((item) => ({ ...item })));
      let hitMine = false;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const target = newBoard[nr][nc];
            if (!target.isRevealed && !target.isFlagged) {
              target.isRevealed = true;
              if (target.isMine) {
                target.isExploded = true;
                hitMine = true;
              } else if (target.neighborCount === 0) {
                revealEmptyNeighbors(newBoard, nr, nc, rows, cols);
              }
            }
          }
        }
      }

      if (hitMine) {
        soundManager.playExplosion();
        endGame(newBoard, false);
      } else {
        soundManager.playClick();
        if (checkWin(newBoard)) {
          endGame(newBoard, true);
        } else {
          setBoard(newBoard);
        }
      }
    }
  };

  // Handle right-click (flagging)
  const handleToggleFlag = (r: number, c: number) => {
    if (gameStatus === 'won' || gameStatus === 'lost') return;
    const cell = board[r][c];
    if (cell.isRevealed) return;

    // Start timer on first flag if idle
    if (gameStatus === 'idle') {
      setGameStatus('playing');
    }

    const newBoard = board.map((row) => row.map((item) => ({ ...item })));
    const target = newBoard[r][c];

    if (!target.isFlagged) {
      target.isFlagged = true;
      setFlagsPlaced((prev) => prev + 1);
      soundManager.playFlag();
    } else {
      target.isFlagged = false;
      setFlagsPlaced((prev) => prev - 1);
      soundManager.playClick();
    }
    setBoard(newBoard);
  };

  // End game logic (win or loss)
  const endGame = (finalBoard: CellData[][], isWin: boolean) => {
    const { rows, cols } = currentDifficulty;

    if (isWin) {
      setGameStatus('won');
      soundManager.playWin();

      // Flag all remaining mines
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (finalBoard[r][c].isMine) {
            finalBoard[r][c].isFlagged = true;
          }
        }
      }
      setFlagsPlaced(currentDifficulty.mines);

      // Save best score
      const scoreKey = currentDifficulty.id;
      const currentBest = bestScores[scoreKey];
      if (!currentBest || seconds < currentBest) {
        const updated = { ...bestScores, [scoreKey]: seconds };
        setBestScores(updated);
        try {
          localStorage.setItem('minesweeper_best_scores', JSON.stringify(updated));
        } catch {
          // Ignore
        }
      }
    } else {
      setGameStatus('lost');
      // Reveal all mines and mark wrong flags
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cData = finalBoard[r][c];
          if (cData.isMine && !cData.isFlagged) {
            cData.isRevealed = true;
          } else if (!cData.isMine && cData.isFlagged) {
            cData.isWrongFlag = true;
          }
        }
      }
    }

    setBoard(finalBoard);
  };

  // Reset button face emoji
  const getFaceEmoji = () => {
    if (gameStatus === 'won') return '😎';
    if (gameStatus === 'lost') return '😵';
    if (isMouseDownOnBoard) return '😮';
    return '😊';
  };

  // Touch event handlers for mobile devices
  const handleTouchStart = (r: number, c: number) => {
    hasMovedRef.current = false;
    touchTimerRef.current = setTimeout(() => {
      if (!hasMovedRef.current) {
        handleToggleFlag(r, c);
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
    }, 450);
  };

  const handleTouchMove = () => {
    hasMovedRef.current = true;
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  // Digits formatting for LCD
  const formatLCD = (val: number): string => {
    if (val < 0) {
      return '-' + String(Math.abs(val)).padStart(2, '0');
    }
    return String(Math.min(val, 999)).padStart(3, '0');
  };

  const remainingMines = currentDifficulty.mines - flagsPlaced;

  // Custom difficulty submit
  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const r = Math.max(5, Math.min(customRows, 30));
    const c = Math.max(5, Math.min(customCols, 30));
    const maxMines = Math.floor(r * c * 0.85);
    const m = Math.max(1, Math.min(customMines, maxMines));
    const customDiff: Difficulty = {
      id: 'custom',
      name: `自訂 (${r}×${c}, ${m}雷)`,
      rows: r,
      cols: c,
      mines: m,
    };
    setCurrentDifficulty(customDiff);
    setShowCustomModal(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#3a4454] p-2 sm:p-4 select-none font-sans text-slate-900">
      {/* Retro Window Container */}
      <div className="bg-[#c0c0c0] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#404040] shadow-2xl rounded-xs max-w-full overflow-hidden">
        {/* Retro Window Header */}
        <div className="bg-gradient-to-r from-[#000080] via-[#1084d0] to-[#000080] text-white px-2 py-1 flex items-center justify-between font-bold text-sm tracking-wide">
          <div className="flex items-center gap-1.5">
            <span className="text-base leading-none">💣</span>
            <span className="truncate">經典踩地雷 Minesweeper</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? '靜音' : '開啟音效'}
              className="w-5 h-5 bg-[#c0c0c0] text-black text-xs font-bold border-t border-l border-white border-b border-r border-[#404040] flex items-center justify-center hover:bg-[#d4d4d4] active:border-inset"
            >
              {soundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} className="text-red-600" />}
            </button>
            <button
              onClick={() => setShowHelp(true)}
              title="遊戲說明"
              className="w-5 h-5 bg-[#c0c0c0] text-black text-xs font-bold border-t border-l border-white border-b border-r border-[#404040] flex items-center justify-center hover:bg-[#d4d4d4]"
            >
              ?
            </button>
            <button
              onClick={() => initBoard(currentDifficulty)}
              title="最小化 / 重置"
              className="w-5 h-5 bg-[#c0c0c0] text-black text-xs font-bold border-t border-l border-white border-b border-r border-[#404040] flex items-center justify-center hover:bg-[#d4d4d4]"
            >
              _
            </button>
            <button
              onClick={() => initBoard(currentDifficulty)}
              title="重新開始"
              className="w-5 h-5 bg-[#c0c0c0] text-black text-xs font-bold border-t border-l border-white border-b border-r border-[#404040] flex items-center justify-center hover:bg-[#d4d4d4]"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Windows Retro Menu Bar */}
        <div className="bg-[#c0c0c0] border-b border-[#808080] px-2 py-1 flex flex-wrap items-center justify-between gap-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">難度：</span>
            <div className="flex flex-wrap gap-1">
              {DIFFICULTIES.map((diff) => (
                <button
                  key={diff.id}
                  onClick={() => setCurrentDifficulty(diff)}
                  className={`px-1.5 py-0.5 border text-xs cursor-pointer ${
                    currentDifficulty.id === diff.id
                      ? 'bg-[#000080] text-white border-inset border-[#404040]'
                      : 'bg-[#e0e0e0] text-black border-t border-l border-white border-b border-r border-[#808080] hover:bg-[#eaeaea]'
                  }`}
                >
                  {diff.name.split(' ')[0]}
                </button>
              ))}
              <button
                onClick={() => setShowCustomModal(true)}
                className={`px-1.5 py-0.5 border text-xs cursor-pointer ${
                  currentDifficulty.id === 'custom'
                    ? 'bg-[#000080] text-white border-inset border-[#404040]'
                    : 'bg-[#e0e0e0] text-black border-t border-l border-white border-b border-r border-[#808080] hover:bg-[#eaeaea]'
                }`}
              >
                自訂
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowScoreModal(true)}
              className="flex items-center gap-1 px-1.5 py-0.5 bg-[#e0e0e0] border-t border-l border-white border-b border-r border-[#808080] text-xs hover:bg-[#f0f0f0]"
            >
              <Trophy size={11} className="text-amber-600" />
              <span>紀錄</span>
            </button>
          </div>
        </div>

        {/* Game Main Body Container */}
        <div className="p-2 sm:p-3 bg-[#c0c0c0]">
          {/* Header Panel (Mines Left, Smiley Reset Button, Timer) */}
          <div className="flex justify-between items-center bg-[#bdbdbd] border-t-2 border-l-2 border-[#808080] border-b-2 border-r-2 border-white px-3 py-1.5 mb-2.5">
            {/* Mines Left LCD */}
            <div
              id="mine-count"
              title="剩餘地雷數 (總地雷數 - 已插旗數)"
              className="bg-black text-[#ff0000] font-mono font-bold text-2xl sm:text-3xl px-1.5 py-0.5 border-2 border-inset border-[#808080] tracking-widest min-w-[58px] sm:min-w-[68px] text-center shadow-inner"
              style={{ fontFamily: "'Courier New', Courier, monospace, 'Digital-7'" }}
            >
              {formatLCD(remainingMines)}
            </div>

            {/* Smiley Reset Button */}
            <button
              id="reset-btn"
              onClick={() => initBoard(currentDifficulty)}
              title="點擊重新開始"
              className="w-10 h-10 sm:w-11 sm:h-11 text-2xl flex items-center justify-center bg-[#c0c0c0] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#808080] active:border-t-2 active:border-l-2 active:border-[#808080] active:border-b-2 active:border-r-2 active:border-white active:bg-[#bdbdbd] cursor-pointer hover:bg-[#d0d0d0] transition-colors"
            >
              {getFaceEmoji()}
            </button>

            {/* Timer LCD */}
            <div
              id="timer"
              title="遊戲時間 (秒)"
              className="bg-black text-[#ff0000] font-mono font-bold text-2xl sm:text-3xl px-1.5 py-0.5 border-2 border-inset border-[#808080] tracking-widest min-w-[58px] sm:min-w-[68px] text-center shadow-inner"
              style={{ fontFamily: "'Courier New', Courier, monospace, 'Digital-7'" }}
            >
              {formatLCD(seconds)}
            </div>
          </div>

          {/* Touch Device Tool Mode Bar (挖掘 / 插旗 切換) */}
          <div className="flex sm:hidden items-center justify-between mb-2 bg-[#d8d8d8] p-1 border border-[#808080] text-xs">
            <span className="text-gray-700 font-medium">觸控模式：</span>
            <div className="flex gap-1">
              <button
                onClick={() => setIsFlagModeMobile(false)}
                className={`flex items-center gap-1 px-2 py-1 border ${
                  !isFlagModeMobile
                    ? 'bg-[#000080] text-white font-bold border-[#404040]'
                    : 'bg-[#c0c0c0] text-black border-t border-l border-white border-b border-r border-[#808080]'
                }`}
              >
                <Shovel size={13} />
                <span>挖開</span>
              </button>
              <button
                onClick={() => setIsFlagModeMobile(true)}
                className={`flex items-center gap-1 px-2 py-1 border ${
                  isFlagModeMobile
                    ? 'bg-[#000080] text-white font-bold border-[#404040]'
                    : 'bg-[#c0c0c0] text-black border-t border-l border-white border-b border-r border-[#808080]'
                }`}
              >
                <Flag size={13} className="text-red-500" />
                <span>插旗</span>
              </button>
            </div>
          </div>

          {/* Minesweeper Grid Board */}
          <div className="overflow-auto max-w-[92vw] max-h-[70vh] border-t-[3px] border-l-[3px] border-[#808080] border-b-[3px] border-r-[3px] border-white p-1 bg-[#808080] flex justify-center">
            <div
              id="board"
              onMouseDown={() => {
                if (gameStatus !== 'won' && gameStatus !== 'lost') {
                  setIsMouseDownOnBoard(true);
                }
              }}
              onMouseUp={() => setIsMouseDownOnBoard(false)}
              onMouseLeave={() => setIsMouseDownOnBoard(false)}
              className="inline-grid bg-[#808080] select-none"
              style={{
                gridTemplateColumns: `repeat(${currentDifficulty.cols}, 30px)`,
              }}
            >
              {board.map((row, r) =>
                row.map((cell, c) => {
                  const numberColorMap: Record<number, string> = {
                    1: 'text-[#0000ff]',
                    2: 'text-[#008000]',
                    3: 'text-[#ff0000]',
                    4: 'text-[#000080]',
                    5: 'text-[#800000]',
                    6: 'text-[#008080]',
                    7: 'text-[#000000]',
                    8: 'text-[#808080]',
                  };

                  return (
                    <div
                      key={`${r}-${c}`}
                      id={`cell-${r}-${c}`}
                      onClick={() => handleCellClick(r, c)}
                      onDoubleClick={() => handleChord(r, c)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleToggleFlag(r, c);
                      }}
                      onTouchStart={() => handleTouchStart(r, c)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      className={`w-[30px] h-[30px] min-w-[30px] min-h-[30px] flex items-center justify-center font-bold select-none text-base cursor-pointer box-border leading-none transition-none ${
                        cell.isRevealed
                          ? cell.isExploded
                            ? 'bg-red-600 border border-[#808080]'
                            : 'bg-[#bdbdbd] border border-[#808080] cursor-default'
                          : 'bg-[#c0c0c0] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#808080] active:border active:border-[#808080]'
                      }`}
                    >
                      {/* Cell Content */}
                      {cell.isRevealed ? (
                        cell.isMine ? (
                          <span className="leading-none text-base">💣</span>
                        ) : cell.neighborCount > 0 ? (
                          <span className={`leading-none ${numberColorMap[cell.neighborCount] || 'text-black'}`}>
                            {cell.neighborCount}
                          </span>
                        ) : null
                      ) : cell.isFlagged ? (
                        cell.isWrongFlag ? (
                          <span className="relative text-sm leading-none flex items-center justify-center">
                            🚩
                            <span className="absolute text-red-600 font-extrabold text-xs">✕</span>
                          </span>
                        ) : (
                          <span className="leading-none text-sm">🚩</span>
                        )
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Game Outcome Status Banner */}
          {gameStatus === 'won' && (
            <div className="mt-2.5 p-2 bg-[#d4edda] border border-[#28a745] text-[#155724] text-center text-xs sm:text-sm font-semibold flex items-center justify-between">
              <span>🎉 恭喜！你成功排除了所有地雷！用時：{seconds} 秒</span>
              <button
                onClick={() => initBoard(currentDifficulty)}
                className="ml-2 px-2 py-0.5 bg-[#28a745] text-white text-xs border border-[#1e7e34] hover:bg-[#218838]"
              >
                再玩一局
              </button>
            </div>
          )}

          {gameStatus === 'lost' && (
            <div className="mt-2.5 p-2 bg-[#f8d7da] border border-[#dc3545] text-[#721c24] text-center text-xs sm:text-sm font-semibold flex items-center justify-between">
              <span>💥 踩到地雷了！點擊笑臉 😊 重新挑戰</span>
              <button
                onClick={() => initBoard(currentDifficulty)}
                className="ml-2 px-2 py-0.5 bg-[#dc3545] text-white text-xs border border-[#bd2130] hover:bg-[#c82333]"
              >
                重新開始
              </button>
            </div>
          )}
        </div>

        {/* Windows Status Bar */}
        <div className="bg-[#c0c0c0] border-t border-[#808080] px-2 py-1 text-[11px] text-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span>
              網格：{currentDifficulty.rows}×{currentDifficulty.cols}
            </span>
            <span>|</span>
            <span>地雷：{currentDifficulty.mines}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline">左鍵挖開 / 右鍵插旗 / 雙擊快開</span>
            <span className="sm:hidden">長按或點選插旗</span>
          </div>
        </div>
      </div>

      {/* Instructions / Rules Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#c0c0c0] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#404040] shadow-xl max-w-md w-full p-1">
            <div className="bg-[#000080] text-white px-2 py-1 flex justify-between items-center text-sm font-bold">
              <span>踩地雷遊戲說明與操作</span>
              <button onClick={() => setShowHelp(false)} className="text-white hover:bg-red-600 px-1">
                ✕
              </button>
            </div>
            <div className="p-3 bg-[#e8e8e8] text-xs text-gray-800 space-y-2 max-h-[75vh] overflow-y-auto">
              <h4 className="font-bold text-sm text-gray-900 border-b border-gray-400 pb-1">遊戲操作：</h4>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <strong className="text-blue-900">左鍵點擊：</strong>開啟方塊。首步保證安全，並會自動遞迴展開周圍空白區域。
                </li>
                <li>
                  <strong className="text-red-700">右鍵點擊：</strong>在方塊上插旗標記地雷（🚩）。
                </li>
                <li>
                  <strong className="text-amber-800">雙擊數字（Chording）：</strong>
                  若某數字周圍已插旗數量等於該數字，雙擊可一次翻開周圍未插旗方塊。
                </li>
                <li>
                  <strong className="text-green-800">手機/觸控支援：</strong>
                  長按格子插旗，或使用螢幕上的「挖開 / 插旗」切換鈕。
                </li>
                <li>
                  <strong className="text-purple-800">中間笑臉（😊）：</strong>
                  點擊即可重置遊戲。
                </li>
              </ul>

              <h4 className="font-bold text-sm text-gray-900 border-b border-gray-400 pb-1 pt-2">勝負判定：</h4>
              <p>
                - <strong>勝利：</strong>避開所有地雷（💣），翻開所有安全的格子。
                <br />- <strong>失敗：</strong>翻開了藏有地雷的方塊。
              </p>

              <h4 className="font-bold text-sm text-gray-900 border-b border-gray-400 pb-1 pt-2">數字代表含義：</h4>
              <p>數字表示該格子周圍相鄰 8 個方格內存在的地雷總數（1 至 8）。</p>
            </div>
            <div className="p-2 flex justify-end bg-[#c0c0c0] border-t border-[#808080]">
              <button
                onClick={() => setShowHelp(false)}
                className="px-4 py-1 bg-[#d4d4d4] border-t border-l border-white border-b border-r border-[#404040] text-xs font-semibold hover:bg-[#e0e0e0] active:border-inset"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Best Scores Modal */}
      {showScoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#c0c0c0] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#404040] shadow-xl max-w-sm w-full p-1">
            <div className="bg-[#000080] text-white px-2 py-1 flex justify-between items-center text-sm font-bold">
              <span>最佳通關紀錄</span>
              <button onClick={() => setShowScoreModal(false)} className="text-white hover:bg-red-600 px-1">
                ✕
              </button>
            </div>
            <div className="p-3 bg-[#e8e8e8] text-xs space-y-2">
              {DIFFICULTIES.map((d) => (
                <div key={d.id} className="flex justify-between items-center border-b border-gray-300 pb-1">
                  <span className="font-semibold text-gray-800">{d.name}：</span>
                  <span className="font-mono font-bold text-blue-800">
                    {bestScores[d.id] !== undefined ? `${bestScores[d.id]} 秒` : '尚未挑戰'}
                  </span>
                </div>
              ))}
              {bestScores['custom'] !== undefined && (
                <div className="flex justify-between items-center border-b border-gray-300 pb-1">
                  <span className="font-semibold text-gray-800">自訂模式：</span>
                  <span className="font-mono font-bold text-blue-800">{bestScores['custom']} 秒</span>
                </div>
              )}
            </div>
            <div className="p-2 flex justify-end bg-[#c0c0c0] border-t border-[#808080]">
              <button
                onClick={() => setShowScoreModal(false)}
                className="px-4 py-1 bg-[#d4d4d4] border-t border-l border-white border-b border-r border-[#404040] text-xs font-semibold hover:bg-[#e0e0e0]"
              >
                確定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Difficulty Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#c0c0c0] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#404040] shadow-xl max-w-xs w-full p-1">
            <div className="bg-[#000080] text-white px-2 py-1 flex justify-between items-center text-sm font-bold">
              <span>自訂棋盤設定</span>
              <button onClick={() => setShowCustomModal(false)} className="text-white hover:bg-red-600 px-1">
                ✕
              </button>
            </div>
            <form onSubmit={handleApplyCustom} className="p-3 bg-[#e8e8e8] text-xs space-y-3">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">列數 Rows (5~24)：</label>
                <input
                  type="number"
                  min={5}
                  max={24}
                  value={customRows}
                  onChange={(e) => setCustomRows(parseInt(e.target.value) || 10)}
                  className="w-full px-2 py-1 bg-white border border-[#808080] text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">行數 Columns (5~30)：</label>
                <input
                  type="number"
                  min={5}
                  max={30}
                  value={customCols}
                  onChange={(e) => setCustomCols(parseInt(e.target.value) || 10)}
                  className="w-full px-2 py-1 bg-white border border-[#808080] text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-1">地雷數 Mines：</label>
                <input
                  type="number"
                  min={1}
                  max={Math.floor(customRows * customCols * 0.8)}
                  value={customMines}
                  onChange={(e) => setCustomMines(parseInt(e.target.value) || 10)}
                  className="w-full px-2 py-1 bg-white border border-[#808080] text-xs font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-400">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-3 py-1 bg-[#d4d4d4] border-t border-l border-white border-b border-r border-[#404040] text-xs"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-[#000080] text-white border border-[#404040] text-xs font-bold"
                >
                  開始遊戲
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

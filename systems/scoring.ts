import { BeadSegment, DefectEvent } from '../store/gameStore';
import { LevelConfig } from '../data/levels';

export interface ScoreBreakdown {
  coverage: number;      // 0-100: what % of the joint was filled
  consistency: number;   // 0-100
  fusion: number;        // 0-100
  defectPenalty: number; // 0-100 (deducted)
  cleanRun: number;      // 0-100
  total: number;         // 0-100
  grade: string;
}

export function calculateScore(
  beads: BeadSegment[],
  defects: DefectEvent[],
  level: LevelConfig,
  completionTimeMs: number,
  expectedTimeMs: number,
  jointStartX: number,
  jointLength: number,
): ScoreBreakdown {
  // Coverage: what fraction of the joint has at least one bead segment
  // Bucket the joint into 6px slots and count how many are filled
  const BUCKET = 6;
  const totalBuckets = Math.ceil(jointLength / BUCKET);
  const filled = new Set<number>();
  for (const seg of beads) {
    filled.add(Math.floor((seg.x - jointStartX) / BUCKET));
  }
  // Full credit at 90% coverage, scales linearly from 0
  const coveragePct = filled.size / totalBuckets;
  const coverageScore = Math.min(100, (coveragePct / 0.9) * 100);

  // Bead consistency: width variance
  const widths = beads.map((b) => b.width);
  const avgWidth = widths.reduce((a, b) => a + b, 0) / (widths.length || 1);
  const variance = widths.reduce((a, b) => a + Math.pow(b - avgWidth, 2), 0) / (widths.length || 1);
  const consistencyScore = Math.max(0, 100 - variance * 2);

  // Fusion quality: penalize incomplete fusion defects
  const fusionDefects = defects.filter((d) => d.type === 'incomplete_fusion');
  const fusionScore = Math.max(0, 100 - fusionDefects.length * 20 - fusionDefects.reduce((a, d) => a + d.severity * 10, 0));

  // Defect penalty
  const defectScore = Math.max(0, 100 - defects.length * 15 - defects.reduce((a, d) => a + d.severity * 5, 0));

  // Clean run bonus (no burn-through or stick)
  const hasBadDefect = defects.some((d) => d.type === 'burn_through' || d.type === 'stick');
  const cleanRun = hasBadDefect ? 0 : 100;

  const total = Math.round(
    coverageScore   * 0.35 +
    consistencyScore * 0.20 +
    fusionScore      * 0.20 +
    defectScore      * 0.15 +
    cleanRun         * 0.10
  );

  const grade =
    total >= 90 ? 'A+' :
    total >= 85 ? 'A' :
    total >= 80 ? 'B+' :
    total >= 75 ? 'B' :
    total >= 70 ? 'C+' :
    total >= 65 ? 'C' :
    total >= 60 ? 'D' : 'F';

  return { coverage: coverageScore, consistency: consistencyScore, fusion: fusionScore, defectPenalty: defectScore, cleanRun, total, grade };
}

import { IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

/**
 * Les seules issues possibles d'un litige. Liste explicite et NON `@IsEnum(DisputeStatus)` :
 * cette énumération contient aussi OPEN ou UNDER_ADMIN_REVIEW, qui ne sont pas des décisions.
 * Un type TypeScript ne protège de rien à l'exécution : sans cette liste, un statut non
 * décisionnel était accepté et faisait passer la commande en « remboursée » sans aucune
 * écriture comptable correspondante.
 */
export const DISPUTE_DECISIONS = ['RESOLVED_REFUND', 'RESOLVED_RELEASE', 'RESOLVED_PARTIAL'] as const;
export type DisputeDecision = (typeof DISPUTE_DECISIONS)[number];

export class ResolveDisputeDto {
  @IsIn(DISPUTE_DECISIONS, { message: `La décision doit être l'une de : ${DISPUTE_DECISIONS.join(', ')}` })
  status: DisputeDecision;

  @IsString()
  @MinLength(10, { message: 'La motivation de la décision doit être documentée (traçabilité)' })
  resolutionNote: string;

  /** Requis uniquement pour RESOLVED_PARTIAL : montant remboursé au client */
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountRefunded?: number;
}

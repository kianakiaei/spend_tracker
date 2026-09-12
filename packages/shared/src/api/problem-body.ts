// The problem+json WIRE SHAPE (RFC 9457; ticket 12), shared verbatim by the
// server renderer (problem.ts), the typed client (client.ts), and any
// future mobile consumer — a dependency-free leaf, portable to any bundle.

export interface ProblemErrorEntry {
  path: string;
  code: string;
  message: string;
}

export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: ProblemErrorEntry[];
}

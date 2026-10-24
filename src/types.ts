export interface PRTarget {
  owner: string;
  repo: string;
  pullNumber: number;
  url: string;
}

export type BotType = 'greptile' | 'coderabbit' | 'deepsource' | 'github_bot' | 'human';

export interface BotMetadata {
  botName: BotType;
  severity?: 'P0' | 'P1' | 'P2' | 'P3' | string;
  title?: string;
  artifacts?: string[];
  rawCategory?: string;
}

export interface CodeModification {
  type: 'suggestion' | 'diff' | 'replacement';
  content: string;
  startLine?: number;
  endLine?: number;
}

export interface ReviewComment {
  id: number;
  path: string;
  line?: number;
  startLine?: number;
  side?: string;
  author: string;
  isBot: boolean;
  botMetadata?: BotMetadata;
  diffHunk: string;
  codeContext?: string;
  rawDiffHunk?: string;
  body: string;
  explanation: string;
  modifications: CodeModification[];
  url: string;
  createdAt: string;
  inReplyToId?: number;
}

export interface PRReviewReport {
  target: PRTarget;
  title: string;
  author: string;
  state: string;
  body: string;
  head: string;
  base: string;
  comments: ReviewComment[];
  totalComments: number;
  fetchedAt: string;
}

export interface CLIOptions {
  target?: string;
  token?: string;
  format: 'terminal' | 'agent' | 'json';
  outputFile?: string;
  includeResolved?: boolean;
}

import type { ReactNode } from 'react';
import type { Statement } from './model';
export function StatementView({value,citations}:{value:Statement;citations:(ids:string[])=>ReactNode}) {
 return <><span className={`label ${value.kind}`}>{value.kind}</span><p>{value.text}</p>{citations(value.sourceIds)}</>;
}

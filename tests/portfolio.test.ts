import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityMix, stageKey, connectionState} from '../src/portfolioModel.js';
import type {Account, WorkspaceResponse} from '../src/model.js';

test('portfolio preserves unfamiliar stages and distinguishes absent deal records', () => {
  const accounts = [{deals: [{stage:{text:' Identified '}},{stage:{text:'future-stage'}},{stage:{text:'Agreed'}}]}, {deals:null}] as Account[];
  assert.deepEqual(opportunityMix(accounts), {counts:{identified:1, qualified:0, cleared:0, agreed:1, other:1}, total:3, missing:1});
  assert.equal(stageKey('FUTURE-STAGE'), 'other');
});
test('connection label requires a recent success, rather than only enabled polling', () => {
  const now = Date.parse('2030-01-01T12:00:00Z');
  const live: WorkspaceResponse['ingestion'] = {mode:'live', lastCheckedAt:'2030-01-01T11:59:00Z', lastChangedAt:null, error:null};
  assert.equal(connectionState(live, now).tone, 'success');
  assert.equal(connectionState({...live, lastCheckedAt:null}, now).tone, 'pending');
  assert.equal(connectionState({...live, lastCheckedAt:'2030-01-01T11:50:00Z'}, now).tone, 'warning');
  assert.equal(connectionState({...live, error:'Check failed'}, now).tone, 'warning');
  assert.equal(connectionState({...live, mode:'cached'}, now).tone, 'neutral');
});

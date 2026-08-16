import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { joinShellCommand } from './with-env.mjs';

describe('joinShellCommand', () => {
  it('keeps --yes on the same command line as the script', () => {
    assert.equal(
      joinShellCommand(['node', 'scripts/cf-sync.mjs', '--yes']),
      'node scripts/cf-sync.mjs --yes',
    );
  });

  it('quotes arguments that contain spaces', () => {
    assert.equal(joinShellCommand(['node', 'my script.mjs']), 'node "my script.mjs"');
  });
});

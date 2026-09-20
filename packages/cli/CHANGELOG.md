# @siftline/cli

## 0.0.2

### Patch Changes

- [#2](https://github.com/Siftline/toolkit/pull/2) [`54b1ad5`](https://github.com/Siftline/toolkit/commit/54b1ad5f6d0c162429ce92c36cafc9ef5617809a) Thanks [@l0st0](https://github.com/l0st0)! - Prove the release pipeline end to end. The scaffold shipped behind an empty
  changeset, so `version`, `pack` and `publish` have never actually run — this
  patch bump exercises all three, and the internal `@siftline/core` ranges in
  `@siftline/cli` and `@siftline/actions` along with them.
- Updated dependencies [[`54b1ad5`](https://github.com/Siftline/toolkit/commit/54b1ad5f6d0c162429ce92c36cafc9ef5617809a)]:
  - @siftline/core@0.0.3

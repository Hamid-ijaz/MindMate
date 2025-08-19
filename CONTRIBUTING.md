## Contributing to MindMate

Thanks for your interest in contributing. The steps below cover forking the repo, creating branches, and opening pull requests.

### 1) Fork the repository

- Click "Fork" on the GitHub page for this repository to create a copy under your account.
- Clone your fork locally and set the upstream remote:

```powershell
git clone https://github.com/hamid-ijaz/MindMate.git
cd MindMate
git remote add upstream https://github.com/Hamid-ijaz/MindMate.git
git fetch upstream
```


### 2) Create a branch

- Always create a feature branch for your work. Branch from the latest `master`:

```powershell
git checkout master
git fetch upstream
git reset --hard upstream/master
git checkout -b feat/short-description
```

- Branch naming suggestions:
  - feat/ - new features
  - fix/ - bug fixes
  - docs/ - documentation only
  - chore/ - maintenance
  - test/ - tests or test updates

Keep branches focused (one logical change per branch).

### 3) Work and test locally

- Install dependencies and run the dev server (if applicable):

```powershell
npm install
npm run dev
```

- Run tests and linters if present:

```powershell
npm test
npm run lint
npm run format
```

Adjust commands if you use yarn/pnpm.

### 4) Commit guidelines

- Write clear, small commits. Use present-tense, imperative messages, e.g. `feat: add ...` or `fix: correct ...`.
- Reference the issue number in the commit or PR description when relevant: `(#123)`.

### 5) Push and open a Pull Request

- Push your branch to your fork:

```powershell
git push origin feat/short-description
```

- On GitHub, open a Pull Request against `Hamid-ijaz/MindMate:master` from your branch.
- In the PR description, include:
  - What you changed and why
  - How to test the change locally
  - Links to related issues
  - Screenshots if the change affects UI

### 6) PR checklist for contributors

- [ ] Branch is up-to-date with `master`
- [ ] Tests pass locally
- [ ] Code is formatted and linted
- [ ] PR description explains the change and testing steps

### 7) Review and merge

- A maintainer will review your PR. Address review comments by pushing new commits to the same branch.
- Do not merge your own PR unless you have explicit permission from the maintainers.

### 8) Reporting issues

- If you find a bug or want to request a feature, open an issue describing the problem, steps to reproduce, and expected behavior.

Thank you for helping improve MindMate!

```markdown
# ai-math-tutor Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the development conventions and workflows used in the `ai-math-tutor` Python codebase. You'll learn about file naming, import/export styles, commit message patterns, and how to write and run tests. These patterns help maintain consistency and readability across the project.

## Coding Conventions

### File Naming
- Use **snake_case** for all Python files.
  - Example:  
    ```python
    # Good
    math_utils.py

    # Bad
    MathUtils.py
    ```

### Import Style
- Use **relative imports** within the package.
  - Example:
    ```python
    from .helpers import solve_equation
    ```

### Export Style
- Use **named exports** (i.e., define functions/classes and import them explicitly).
  - Example:
    ```python
    # In math_utils.py
    def add(a, b):
        return a + b

    # In another module
    from .math_utils import add
    ```

### Commit Messages
- Follow **conventional commit** format.
- Use the `fix` prefix for bug fixes.
- Keep messages concise (average ~37 characters).
  - Example:
    ```
    fix: correct calculation in solve_quadratic
    ```

## Workflows

### Code Contribution
**Trigger:** When adding or updating code  
**Command:** `/contribute-code`

1. Create or update Python files using snake_case naming.
2. Use relative imports for internal modules.
3. Write clear, named exports for functions/classes.
4. Write a conventional commit message (e.g., `fix: update equation solver`).
5. If applicable, add or update corresponding test files.

### Testing
**Trigger:** When verifying code correctness  
**Command:** `/run-tests`

1. Write test files using the `*.test.ts` pattern (for TypeScript tests).
2. Use the `vitest` framework for running tests.
3. Run the test suite to ensure all tests pass.
   - Example command:
     ```
     vitest run
     ```

## Testing Patterns

- Test files are written in TypeScript with the `.test.ts` suffix.
- The `vitest` framework is used for testing.
- Each test file should correspond to a module or feature.
- Example test file name:  
  ```
  math_utils.test.ts
  ```

## Commands
| Command          | Purpose                                 |
|------------------|-----------------------------------------|
| /contribute-code | Add or update code following conventions |
| /run-tests       | Run the test suite with vitest           |
```
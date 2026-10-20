<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git

- Never create branches, worktrees, or commits automatically. Only do so when the user explicitly ask for that specific action in the current request.
- Leave changes uncommitted in the working tree on the current branch and let the user decide when and how to commit.

## Database

- Apply schema changes only with `npm run db:push` (`drizzle-kit push`). Never generate or run migrations (`drizzle-kit generate`, `drizzle-kit migrate`, or a `drizzle/` migrations folder).
- This is a development project. There is no backwards compatibility and the data is worthless. Prefer data loss: never backfill, migrate, or preserve existing rows, and never spend effort on keeping old data working. Every schema change means a clean state.

## Forms

Every form that writes to the database follows the same three layers. See `components/bot-dialog.tsx`, `action/bot.ts`, and `insertBotSchema` in `db/schema.ts` as the reference implementation.

### 1. Schema: derive it from the table

- Generate the validation schema from the Drizzle table with `createInsertSchema` from `drizzle-zod`, and export it from `db/schema.ts` next to the table (e.g. `insertBotSchema`). Never hand-write a parallel zod object that duplicates column definitions.
- Put field rules (`trim`, `min`, `max`, messages) in the refinement callbacks, then `.pick()` only the fields a user may set. Server-owned columns (`id`, `userId`, timestamps, internal IDs) must never be in the picked schema.
- Use the same schema on the client and the server. Don't create a separate form schema.
- Avoid zod transforms that change the input type; use `.trim()` and similar so `z.input` and `z.output` stay compatible with react-hook-form.
- Package note: drizzle-orm 0.45 has no built-in zod export, so use the `drizzle-zod` package. Keep `@hookform/resolvers` pinned to `5.4.0`. Later 5.x versions pull an optional peer that requires zod 3 and break `npm install`. Don't fix that with `--legacy-peer-deps` or `--force`.

### 2. Server action: authenticate, re-validate, write

- Put server actions in `action/<resource>.ts` with `"use server"` at the top of the file. Name them `<verb><Resource>` (e.g. `createBot`).
- Type the input as `z.input<typeof insert<Resource>Schema>`, not `FormData`.
- First line: `const { userId } = await auth.protect()` from `@clerk/nextjs/server`. Server actions are public POST endpoints, so never rely on the page's auth check.
- Always `safeParse` the input again on the server. On failure, return `{ ok: false, errors: z.flattenError(error).fieldErrors }`. Don't throw for validation errors.
- Set server-owned fields (`userId` from Clerk, etc.) in the action. Normalize empty optional strings to `null` before inserting.
- Insert with `.returning()`, call `revalidatePath` for affected routes, and return `{ ok: true, <resource> }`.

### 3. Client form: react-hook-form + shadcn Field

- Client component with `"use client"`. Use `useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({ resolver: zodResolver(schema) })`.
- Render each field with `Controller` wrapping shadcn `Field`, `FieldLabel`, the control (`Input`, `Textarea`, …), and `FieldError`. Group fields in `FieldGroup`. Never use raw `div` + `label` layouts or `space-y-*`.
- Validation states: `data-invalid={fieldState.invalid}` on `Field`, `aria-invalid={fieldState.invalid}` on the control, and render `<FieldError errors={[fieldState.error]} />` only when invalid.
- Give every control an `id` matching `FieldLabel htmlFor`. Pass `value={field.value ?? ""}` for nullable columns.
- Submit by calling the server action inside `startTransition` from `useTransition`. On `ok: false`, map each returned field error onto the form with `form.setError`. Wrap the call in `try/catch` and show a `toast.add(...)` from `@/components/ui/toast` for unexpected failures. On success, show a toast and close or reset the form.
- Pending state: disable the submit button and show `<Spinner data-icon="inline-start" />`. Button has no `isLoading` prop.
- Icons in buttons use `data-icon="inline-start" | "inline-end"` with no size classes. Non-submit buttons inside a form must have `type="button"`.
- Values generated on the client (random seeds, IDs) go into the form state via `form.reset` / `form.setValue`, not during render, so server and client markup match.

### Forms in dialogs

- Use `components/ui/dialog.tsx` (Base UI). Custom triggers use the `render` prop, not `asChild`: accept the trigger as `children: React.ReactElement` and render `<DialogTrigger render={children} />`, so server pages can pass their own `Button`.
- Control `open` with state. Reset the form in `onOpenChange` when the dialog opens, so every open starts clean.
- Always include `DialogTitle` and `DialogDescription` in a `DialogHeader`.
- Give the `<form>` an `id` and put actions in `DialogFooter`: `<DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>` and a submit `Button` with `type="submit" form="<form-id>"`.

## DiceBear

Use DiceBear 10. Documentation: https://www.dicebear.com/llms.txt

There are seven native cores with identical output, not one library with
wrappers. Use the one matching this project's language. Do not reach for the
JavaScript core when the project is written in something else:

    JavaScript  @dicebear/core + @dicebear/styles
    PHP         dicebear/core + dicebear/styles
    Python      dicebear-core + dicebear-styles
    Rust        dicebear-core + dicebear-styles
    Go          github.com/dicebear/dicebear-go/v10 + github.com/dicebear/styles/v10
    Dart        dicebear_core + dicebear_styles
    C#          DiceBear.Core + DiceBear.Styles

Every style page carries a loading snippet for all seven, for example
https://www.dicebear.com/styles/lorelei/index.md

HTTP API: https://api.dicebear.com/10.x/<style>/svg?seed=<seed> The seed is a
query parameter, not a path segment. Options are query parameters too; array
values are separated by commas.

Options named after a component end in Variant: eyesVariant, not eyes. This
holds in all seven cores and in the HTTP API. Look up the options of a style at
https://api.dicebear.com/10.x/<style>/options.json

Write these forms, not the ones on the left. The left column is pre-10 and the
API does not reject it, so an outdated call runs and silently does the wrong
thing:

    avatars.dicebear.com/api/<style>/<seed>.svg  ->  api.dicebear.com/10.x/<style>/svg?seed=<seed>
    api.dicebear.com/9.x/<style>/svg             ->  api.dicebear.com/10.x/<style>/svg
    npm install @dicebear/collection             ->  npm install @dicebear/styles
    npm install @dicebear/lorelei                ->  npm install @dicebear/styles
    createAvatar(lorelei, { seed })              ->  new Avatar(new Style(definition), { seed })
    { eyes: ['variant01'] }                      ->  { eyesVariant: ['variant01'] }
    ?radius=50                                   ->  ?borderRadius=50

Only JavaScript and the HTTP API have a pre-10 form. The other six cores were
released in 2026 and never had one, so any older-looking PHP, Python, Rust, Go,
Dart or C# API attributed to DiceBear is invented rather than outdated.

<!-- TRIGGER.DEV SKILLS START -->
## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.agents/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-authoring-tasks`, `trigger-chat-agent-advanced`, `trigger-cost-savings`, `trigger-getting-started`, `trigger-realtime-and-frontend`, `trigger-authoring-chat-agent`.
<!-- TRIGGER.DEV SKILLS END -->

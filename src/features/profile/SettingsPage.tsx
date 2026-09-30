import { InlineNotice } from "../../shared/components/Feedback";
import { Button } from "../../shared/components/Button";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { components } from "../../api/generated/schema";
import { ProfileError } from "./api";
import { useUpdateNickname } from "./queries";

const nicknameSchema = z
  .string()
  .trim()
  .min(1, "Enter a nickname.")
  .refine(
    (value) => Array.from(value).length <= 64,
    "Use at most 64 characters.",
  )
  .refine(
    (value) => !value.includes("\0"),
    "Nickname cannot contain null characters.",
  );

function errorMessage(error: Error) {
  if (error instanceof ProfileError) {
    if (error.status === 400)
      return "That nickname is invalid. Please check it.";
    if (error.status === 409) return "That nickname is already in use.";
    if (error.status === 415)
      return "Unable to send the update. Please try again; if it continues, contact support.";
  }
  return "Unable to save your nickname. Please try again.";
}

export function SettingsPage({
  user,
}: {
  user: components["schemas"]["User"];
}) {
  const update = useUpdateNickname();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<{ nickname: string }>({
    defaultValues: { nickname: user.nickname },
  });
  const nickname = useWatch({ control, name: "nickname" });
  const changed = nickname.trim() !== user.nickname;
  return (
    <section className="mt-8" aria-labelledby="settings-title">
      <h2 id="settings-title" className="text-2xl font-semibold">
        Settings
      </h2>
      <div className="rounded border bg-white p-4">
        <h3 className="font-semibold">Profile</h3>
        <p className="mt-3 break-all">{user.email}</p>
        <form
          noValidate
          className="mt-6"
          onSubmit={handleSubmit(async ({ nickname }) => {
            const normalized = nicknameSchema.parse(nickname);
            if (normalized === user.nickname) return;
            try {
              const saved = await update.mutateAsync({ nickname: normalized });
              reset({ nickname: saved.nickname });
            } catch {
              /* Mutation state supplies safe feedback. */
            }
          })}
        >
          <label className="block" htmlFor="nickname">
            Nickname
          </label>
          <input
            id="nickname"
            className="mt-2 min-h-11 w-full rounded border p-2"
            disabled={update.isPending}
            aria-invalid={!!errors.nickname}
            aria-describedby={errors.nickname ? "nickname-error" : undefined}
            {...register("nickname", {
              validate: (value) => {
                const result = nicknameSchema.safeParse(value);
                return (
                  result.success ||
                  result.error.issues[0]?.message ||
                  "Invalid nickname."
                );
              },
              onChange: () => update.reset(),
            })}
          />
          {errors.nickname && (
            <InlineNotice id="nickname-error" tone="error">
              {errors.nickname.message}
            </InlineNotice>
          )}
          {update.isError && (
            <InlineNotice tone="error" className="mt-3">
              {errorMessage(update.error)}
            </InlineNotice>
          )}
          {update.isSuccess && (
            <InlineNotice className="mt-3">Nickname saved.</InlineNotice>
          )}
          <Button
            variant="primary"
            type="submit"
            disabled={!changed || update.isPending}
            className="mt-4 min-h-11 rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-60"
          >
            {update.isPending ? "Saving…" : "Save nickname"}
          </Button>
          {!changed && !update.isSuccess && (
            <p className="mt-2">No changes to save.</p>
          )}
        </form>
      </div>
    </section>
  );
}

import { useIsMutating } from "@tanstack/react-query";
import { profileMutationKey } from "./queries";
import { Link } from "react-router";
import { AvatarEditor } from "./AvatarEditor";
import { socialUrl } from "./social";
import { InlineNotice } from "../../shared/components/Feedback";
import { Button } from "../../shared/components/Button";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { components } from "../../api/generated/schema";
import { ProfileError } from "./api";
import { useUpdateProfile } from "./queries";

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
      return "Those profile details are invalid. Please check them.";
    if (error.status === 409) return "That nickname is already in use.";
    if (error.status === 415)
      return "Unable to send the update. Please try again; if it continues, contact support.";
  }
  return "Unable to save your profile. Please try again.";
}

export function SettingsPage({
  user,
}: {
  user: components["schemas"]["User"];
}) {
  const update = useUpdateProfile();
  const accountBusy = useIsMutating({ mutationKey: profileMutationKey }) > 0;
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, defaultValues },
  } = useForm<{
    nickname: string;
    instagram_url: string;
    tiktok_url: string;
    youtube_url: string;
  }>({
    defaultValues: {
      nickname: user.nickname,
      instagram_url: user.instagram_url ?? "",
      tiktok_url: user.tiktok_url ?? "",
      youtube_url: user.youtube_url ?? "",
    },
  });
  const values = useWatch({ control });
  const changed = (
    ["nickname", "instagram_url", "tiktok_url", "youtube_url"] as const
  ).some(
    (field) => (values[field] ?? "").trim() !== (defaultValues?.[field] ?? ""),
  );
  return (
    <section aria-labelledby="settings-title">
      <h2 id="settings-title" className="page-title">
        Change profile details
      </h2>
      <Link className="inline-block mb-4 underline" to={`/users/${user.id}`}>
        Back to profile
      </Link>
      <AvatarEditor user={user} />
      <div className="profile-details-panel">
        <h3 className="font-semibold">Profile</h3>
        <p className="mt-3 break-all">{user.email}</p>
        <form
          noValidate
          className="mt-6"
          onSubmit={handleSubmit(async (values) => {
            if (!changed) return;
            const body: components["schemas"]["PatchMe"] = {};
            if (values.nickname.trim() !== defaultValues?.nickname)
              body.nickname = nicknameSchema.parse(values.nickname);
            for (const platform of [
              "instagram",
              "tiktok",
              "youtube",
            ] as const) {
              const field = `${platform}_url` as const;
              if (values[field].trim() !== (defaultValues?.[field] ?? ""))
                body[field] = socialUrl(platform, values[field]);
            }
            try {
              const saved = await update.mutateAsync(body);
              reset({
                nickname: saved.nickname,
                instagram_url: saved.instagram_url ?? "",
                tiktok_url: saved.tiktok_url ?? "",
                youtube_url: saved.youtube_url ?? "",
              });
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
          <fieldset className="mt-6 space-y-4" disabled={update.isPending}>
            <legend className="font-semibold">
              Social profiles{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </legend>
            {(["instagram", "tiktok", "youtube"] as const).map((platform) => {
              const field = `${platform}_url` as const;
              const label =
                platform === "instagram"
                  ? "Instagram"
                  : platform === "tiktok"
                    ? "TikTok"
                    : "YouTube";
              return (
                <div key={platform}>
                  <label htmlFor={field}>{label} URL</label>
                  <input
                    id={field}
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    placeholder={`https://${platform}.com/${platform === "instagram" ? "driver" : "@driver"}`}
                    className="mt-2 min-h-11 w-full rounded border p-2"
                    aria-invalid={!!errors[field]}
                    aria-describedby={
                      errors[field] ? `${field}-error` : undefined
                    }
                    {...register(field, {
                      validate: (value) => {
                        try {
                          socialUrl(platform, value);
                          return true;
                        } catch (error) {
                          return error instanceof Error
                            ? error.message
                            : "Enter a valid profile URL.";
                        }
                      },
                      onChange: () => update.reset(),
                    })}
                  />
                  {errors[field] && (
                    <InlineNotice tone="error" id={`${field}-error`}>
                      {errors[field].message}
                    </InlineNotice>
                  )}
                </div>
              );
            })}
          </fieldset>
          {update.isError && (
            <InlineNotice tone="error" className="mt-3">
              {errorMessage(update.error)}
            </InlineNotice>
          )}
          {update.isSuccess && (
            <InlineNotice className="mt-3">Profile details saved.</InlineNotice>
          )}
          <Button
            variant="primary"
            type="submit"
            disabled={!changed || accountBusy}
            className="mt-4 min-h-11 rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-60"
          >
            {update.isPending ? "Saving…" : "Save profile details"}
          </Button>
          {!changed && !update.isSuccess && (
            <p className="mt-2">No changes to save.</p>
          )}
        </form>
      </div>
    </section>
  );
}

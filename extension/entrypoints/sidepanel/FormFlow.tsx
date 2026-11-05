import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { errorMessage, isUnauthorized } from "@/lib/api";
import { extractFormValuesMutation } from "@/lib/client/@tanstack/react-query.gen";
import type { ExtractedValue } from "@/lib/client";
import { MAX_IMAGES, prepareImage, type PreparedImage } from "@/lib/images";
import { fillActiveTab, scanActiveTab } from "@/lib/messages";
import { draftFrom, fillSummary, valuesToFill, type Draft } from "@/lib/review";

import { PrimaryButton, SecondaryButton } from "./buttons";
import { ImageDrop } from "./ImageDrop";
import { ReviewList } from "./ReviewList";

/** Values read for the form at `url`, and the user's edits of them. */
type Review = { url: string; values: ExtractedValue[]; draft: Draft };

const SCAN_KEY = ["scan"];

export function FormFlow({ onNeedToken }: { onNeedToken: () => void }) {
  const queryClient = useQueryClient();
  const scan = useQuery({ queryKey: SCAN_KEY, queryFn: scanActiveTab });
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [imageError, setImageError] = useState<string>();
  const [review, setReview] = useState<Review>();

  const extract = useMutation(extractFormValuesMutation());
  const fill = useMutation({ mutationFn: fillActiveTab });

  // The panel stays open across tabs and navigations; scan whatever is in front now.
  useEffect(() => {
    const rescan = () => void queryClient.invalidateQueries({ queryKey: SCAN_KEY });
    const onUpdated = (_id: number, change: { status?: string }) => {
      if (change.status === "complete") rescan();
    };
    browser.tabs.onActivated.addListener(rescan);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      browser.tabs.onActivated.removeListener(rescan);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [queryClient]);

  async function addFiles(files: File[]) {
    const room = MAX_IMAGES - images.length;
    if (files.length === 0 || room <= 0) return;
    setPreparing(true);
    setImageError(undefined);
    const results = await Promise.allSettled(files.slice(0, room).map(prepareImage));
    const prepared = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
    const failed = results.find((result) => result.status === "rejected");
    setImages((current) => [...current, ...prepared]);
    if (failed) setImageError(errorMessage(failed.reason));
    else if (files.length > room) setImageError(`Only the first ${room} images were added.`);
    setPreparing(false);
  }

  function removeImage(id: string) {
    setImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((image) => image.id !== id);
    });
  }

  function startOver() {
    for (const image of images) URL.revokeObjectURL(image.previewUrl);
    setImages([]);
    setImageError(undefined);
    setReview(undefined);
    extract.reset();
    fill.reset();
  }

  function changeImages() {
    setReview(undefined);
    fill.reset();
  }

  if (scan.isPending) return <p className="text-slate-600">Looking for the form…</p>;

  if (scan.isError) {
    return (
      <>
        <p className="text-slate-700">{errorMessage(scan.error)}</p>
        <SecondaryButton onClick={() => void scan.refetch()}>Scan again</SecondaryButton>
      </>
    );
  }

  const form = scan.data;

  if (review) {
    const onForm = form.url === review.url;
    return (
      <>
        <p className="text-slate-600">{form.profile?.name}</p>
        <ReviewList
          fields={form.fields}
          values={review.values}
          draft={review.draft}
          outcomes={fill.data?.outcomes}
          onChange={(id, value) => setReview({ ...review, draft: { ...review.draft, [id]: value } })}
        />
        {!onForm && <p className="text-amber-800">Go back to the form tab to fill it.</p>}
        {fill.isError && <p className="text-red-700">{errorMessage(fill.error)}</p>}
        {fill.isSuccess && (
          <p className="text-green-800">
            {fillSummary(form.fields, fill.data.outcomes)} Check the page, then submit it yourself.
          </p>
        )}
        <div className="sticky bottom-0 flex flex-col gap-2 bg-slate-50 py-2">
          <PrimaryButton disabled={!onForm || fill.isPending} onClick={() => fill.mutate(valuesToFill(review.draft))}>
            {fill.isPending ? "Filling…" : fill.isSuccess ? "Fill again" : "Fill form"}
          </PrimaryButton>
          <div className="flex gap-2">
            <SecondaryButton onClick={changeImages}>Change images</SecondaryButton>
            <SecondaryButton onClick={startOver}>Start over</SecondaryButton>
          </div>
        </div>
      </>
    );
  }

  function read() {
    extract.mutate(
      {
        body: {
          fields: form.fields,
          images: images.map(({ media_type, data }) => ({ media_type, data })),
        },
      },
      {
        onSuccess: ({ values }) => setReview({ url: form.url, values, draft: draftFrom(values) }),
      },
    );
  }

  return (
    <>
      <p className="text-slate-600">
        {form.profile ? `${form.profile.name}: ${form.fields.length} fields` : "Drop images to fill the form on this page."}
      </p>
      <ImageDrop images={images} preparing={preparing} onAdd={(files) => void addFiles(files)} onRemove={removeImage} />
      {imageError && <p className="text-red-700">{imageError}</p>}
      {extract.isError && <p className="text-red-700">{errorMessage(extract.error)}</p>}
      {extract.isError && isUnauthorized(extract.error) && (
        <SecondaryButton onClick={onNeedToken}>Set your API token</SecondaryButton>
      )}
      <PrimaryButton disabled={images.length === 0 || preparing || extract.isPending} onClick={read}>
        {extract.isPending ? "Reading images…" : "Read values"}
      </PrimaryButton>
      {images.length > 0 && !extract.isPending && <SecondaryButton onClick={startOver}>Clear images</SecondaryButton>}
    </>
  );
}

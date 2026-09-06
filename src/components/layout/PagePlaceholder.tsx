import { cx } from "@/lib/cx";

/**
 * 未実装ページの中身（W1-10）。
 *
 * URLの骨格を先に通すために置いている。中身は各タスクで差し替える。
 * 「いつ何が入るか」を画面に出しておくと、レビュー時に
 * 「作り忘れ」と「まだ作っていない」を取り違えずに済む。
 */
export function PagePlaceholder({
  title,
  description,
  plannedIn,
  className,
}: {
  title: string;
  description: string;
  /** このページを実装するタスク。例: "W2-5" */
  plannedIn: string;
  className?: string;
}) {
  return (
    <div className={cx("mx-auto max-w-3xl px-6 py-16", className)}>
      <h1 className="text-3xl">{title}</h1>
      <p className="text-ink-muted mt-3 text-sm leading-relaxed">{description}</p>
      <p className="border-line text-ink-muted mt-8 border-l-2 pl-4 text-xs">
        このページは <span className="text-ink font-medium">{plannedIn}</span> で実装します。
        いまはURLの骨格だけが通っている状態です。
      </p>
    </div>
  );
}

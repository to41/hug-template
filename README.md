# HUG 支援計画作成アシスト

児童発達支援・保育所等訪問支援の個別支援計画向けに、定型文を選択・編集してHUGへ貼り付ける静的Webアプリです。

2026年の現行通知に照合した主要加算の文例と確認事項を追加しました。制度基準日・確認日は2026-10-06です。全加算一覧、請求可否判定、単位数計算は対象にしていません。

## 旧版

`legacy/index.html` は、元の main コミット `687410ef4793e22c718aca90da5ff9e99fe5ef2a` の `index.html` をそのまま保存したものです。新版の「旧版を開く」から利用できます。改修ブランチの作成・PR提出は main へのマージを含みません。

## 起動

Vercelでは静的ファイルとして配信します。アプリの実行にはビルド工程やNode.jsは必要ありません。ローカルではHTTPサーバーで配信してください。

```sh
python3 -m http.server 8000
```

`http://localhost:8000/` を開きます。JSONを読み込むため、ファイルを直接開く `file://` 形式は新版では使えません。

## 更新するファイル

| ファイル | 内容 |
|---|---|
| `data/templates.json` | 一般支援文と加算関連の計画文。20件の元の一般支援文を保持 |
| `data/additions.json` | 加算の正式名称・対象サービス・確認事項・必要な記録・根拠ページ |
| `data/original-templates.json` | 元の24件の文例を保存した参照データ |
| `index.html` / `styles.css` | 画面・表示スタイル |
| `app.js` | サービス・タブ・検索による絞り込み、編集・コピー |
| `docs/2026-changes.md` | 元の24件の対応表、追加内容、確認範囲 |

サービス識別子は `child`（児発）と `visit`（保育所等訪問支援）です。加算関連の文例は `additionId` により加算データを参照します。複数の入力欄に使える文例は `tabs` に複数の値を指定できます。

`metadata.reviewedAt` は制度内容を照合した日、`sourceRevisedAt` は根拠通知の最終改正日です。両者を各加算の施行日と混同しないでください。共通の法的適用開始日は確定していないため `effectiveFrom` は `null` です。加算別の施行日を追加する際は告示・附則を確認してください。

原典リンクの `sourcePages` はPDFの物理ページを1から数えた値です。文例はアプリ用に作成した案であり、原典の引用や指定様式ではありません。事業所の届出・対象児童・指定権者の取扱いは運用時に確認してください。

## 確認

```sh
npm install
npm test
```

データの整合性、旧版の完全保存、元の一般支援文の維持、サービス別の表示、検索・編集・コピーの処理、クリア確認、読込エラーを確認します。DOMテストのクリップボードは代替実装なので、実機でのコピー動作は別途確認してください。

データだけを確認する場合は `npm run test:data` を実行してください。

実ブラウザでの動作・レイアウト確認は次のコマンドで実行できます。スクリーンショットはリポジトリの一つ上の作業ディレクトリに出力します。

```sh
npx playwright install chromium --only-shell
npm run test:browser
```

## 制度資料

- [こども家庭庁：令和8年度報酬改定](https://www.cfa.go.jp/policies/shougaijishien/shisaku/r8hoshukaitei)
- [実施上の留意事項（令和8年3月31日改正）](https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/2c5e1bb4-ee80-462b-992f-06f0d8c9b774/4aacbf83/20260402_policies_shougaijishien_shisaku_r8hoshukaitei_17.pdf)

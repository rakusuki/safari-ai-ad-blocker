# Safari AI Ad Blocker

Safari上の広告を高速にブロックし、未知の広告候補を軽量なDOM解析で自動検出するiPhone向けSafari Web Extensionです。最低動作ターゲットとして **iPhone 12 mini** を意識し、LLMをページごとに常時呼び出さない省電力・低遅延構成を採用します。

## v0.2.0 の構成

- Safari Declarative Net Requestで既知広告ネットワークを事前ブロック
- DOMの `id` / `class` / 属性 / テキスト / URL / iframe / サイズ / position から広告スコアを算出
- 高信頼候補のみ自動非表示
- SPAや遅延挿入広告をMutationObserverで再検出
- Safari拡張ポップアップにローカル件数を表示
- LLM/APIキーはまだ組み込まず、安全な差し替え境界のみ設計

## iPhone 12 mini対応方針

Safari Web Extension自体はiOS 15以降で利用できますが、このManifest V3・動的DNRルール構成はiOS 15.4以降のSafariを対象とします。このプロジェクトではiPhone 12 miniでも処理負荷を抑えるため、既知広告はSafari側の宣言的ルールに任せ、DOM解析対象も広告らしい要素に限定しています。

## Xcodeプロジェクト生成

macOS + Xcodeでリポジトリ直下から実行します。

```bash
./scripts/bootstrap_xcode.sh
```

Appleの現在のツール名 `safari-web-extension-packager` を使い、`Xcode/` 以下にiOS専用Swiftプロジェクトを生成します。

生成後:

1. Xcodeで生成されたプロジェクトを開く
2. AppターゲットとSafari Web Extensionターゲットの `Signing & Capabilities` でDeveloper Teamを選択
3. iPhone 12 mini実機を接続してRun
4. iPhoneの `設定 > アプリ > Safari > 機能拡張` から拡張を有効化
5. Safariでサイトアクセス権を許可

## v0.2.0 の使い方

Safariの拡張ポップアップから操作します。

1. **広告ではない**：非表示要素・確認候補の一覧から選択します。元のインライン `display` と `!important` を復元し、その要素を同じホストで再ブロックしないselectorルールを保存します。許可した要素の親・子も保護します。
2. **ブロック**：確認候補を手動で非表示にし、同じホストのselectorルールとして保存します。
3. **要素を選んでブロック**：ポップアップを閉じた後、ページの要素をタップして確認します。上部の取消ボタンまたはEscapeで中止できます。ページ全体やmainなどの主要領域は選択できません。
4. **このサイトを許可**：そのホストのDOM判定・手動ブロックを停止し、元の表示に戻します。優先度100の動的 `allowAllRequests` ルールで既知広告通信も許可します。切替後はページを再読み込みしてください。有効化すると保存済みのselectorルールも再適用します。
5. **このサイトのルールを削除**：手動ブロック・要素の許可・サイト全体の許可・誤検知件数を削除します。自動判定は再開します。

サイトは **hostname完全一致**（サブドメインは別、同一ホストのHTTP/HTTPS・ポート・パスは共通）です。データは `browser.storage.local` とSafariの端末内動的ルールだけに保存し、同期・サーバ送信・ページ本文やURL履歴の記録は行いません。誤検知記録はselectorとサイトごとの件数だけです。

selectorは一意のIDを優先し、なければ要素階層と `nth-of-type` を使います。サイト側のID・構造変更によりルールが効かなくなったり別の要素に一致したりする可能性があります。その場合はサイトのルールを削除して選び直してください。確認一覧は先頭100件を表示します。クロスオリジンiframeの内部やページのShadow DOM内部は選択対象外です。

要素単位の「広告ではない」はDOM表示を復元します。既に通信ルールで止めた画像等を再取得するにはサイト全体を許可して再読み込みしてください。

## 自動検証

開発用Node.js 22以降で実行します。依存関係はテスト用のみで、拡張機能には含めません。

```bash
npm ci --ignore-scripts
npm run check
npm test
```

GitHub Actionsはpush・Pull Request・手動実行時にNode.js 22/24で同じ検証を行います。jsdomでDOM・イベント・永続ルールの動作を検証し、拡張APIはテスト用に模擬します。Safariの実API・iPhone実機・Xcodeビルドは別途確認が必要です。実機確認手順は `docs/TESTING.md` にあります。

## GitHubへ新規登録

GitHub CLIにログイン済みなら、リポジトリ直下で次を実行できます。

```bash
git init
git add .
git commit -m "feat: initial Safari AI ad blocker MVP"
git branch -M main
gh repo create rakusuki/safari-ai-ad-blocker \
  --public \
  --description "Lightweight AI-assisted Safari ad blocker for iPhone, optimized for iPhone 12 mini." \
  --source=. \
  --remote=origin \
  --push
```

Topics推奨:

```bash
gh repo edit rakusuki/safari-ai-ad-blocker \
  --add-topic ios \
  --add-topic iphone \
  --add-topic safari \
  --add-topic safari-extension \
  --add-topic adblock \
  --add-topic content-blocker \
  --add-topic javascript \
  --add-topic swift \
  --add-topic privacy \
  --add-topic machine-learning
```

## LLM導入方針

LLMは全DOMを毎回判定するのではなく、ヒューリスティックで判断できない中信頼度候補だけに使います。

```text
DNR -> heuristic -> Core ML -> optional LLM -> durable blocking rule
```

APIキーをSafari拡張へ直接埋め込むのは禁止方針です。将来はKeychainを利用するネイティブiOSアプリ経由、自己ホストAPI、またはCore MLオンデバイスモデルを利用します。

詳細は `docs/ARCHITECTURE.md` と `docs/ROADMAP.md` を参照してください。

## 注意

自動広告判定は誤検知の可能性があります。高信頼度候補（0.85以上）だけを自動非表示にし、中信頼度候補（0.65以上）は確認一覧に表示します。

## License

MIT License

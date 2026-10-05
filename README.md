# Safari AI Ad Blocker

Safari上の広告を高速にブロックし、未知の広告候補を軽量なDOM解析で自動検出するiPhone向けSafari Web Extensionです。最低動作ターゲットとして **iPhone 12 mini** を意識し、LLMをページごとに常時呼び出さない省電力・低遅延構成を採用します。

## v0.1.0 の構成

- Safari Declarative Net Requestで既知広告ネットワークを事前ブロック
- DOMの `id` / `class` / 属性 / テキスト / URL / iframe / サイズ / position から広告スコアを算出
- 高信頼候補のみ自動非表示
- SPAや遅延挿入広告をMutationObserverで再検出
- Safari拡張ポップアップにローカル件数を表示
- LLM/APIキーはまだ組み込まず、安全な差し替え境界のみ設計

## iPhone 12 mini対応方針

Safari Web ExtensionはiOS 15以降で利用できます。このプロジェクトではiPhone 12 miniでも処理負荷を抑えるため、既知広告はSafari側の宣言的ルールに任せ、DOM解析対象も広告らしい要素に限定しています。

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

自動広告判定は誤検知の可能性があります。v0.1.0では高信頼度候補のみ非表示にし、中信頼度候補は非表示にせずマークだけ付けます。

## License

MIT License

## リファクタリング計画（2025-11-22）

1. **依存関係の棚卸し**
	- core・scenes・shader 各層の参照関係を整理し、循環や責務の重複を記録する。
	- UIDrawResources など共有構造体の利用箇所を列挙し、後続ステップの指針とする。

2. **ユーティリティ整理と命名統一**
	- `src/utils` 配下の関数をカテゴリ別に棚卸しし、bandManager 内のロジックで重複している処理を順次移管。
	- 命名揺れ（camelCase/kebabCase など）を確認し、インポート経路を揃える。

3. **bandManager の責務分割**
	- パラメータ適用・描画ロジック・状態管理を内部メソッドへ段階的に切り出し、挙動維持を検証。
	- 十分に安定した段階で描画補助クラス／ファイルへ分離し、UI からの利用に影響がないか確認。

4. **TexManager / UIManager のインターフェース調整**
	- update/draw フローで受け渡すデータ構造を統一し、冗長な getter を段階的に削減。
	- リソース取得タイミングの標準化と、将来的なテスト容易性のための抽象化を進める。

5. **シェーダ関連の整理**
	- `public/shader/post.frag` を中心にユーティリティ・uniform 設定の重複を抽出し、CPU 側の管理コードと整合させる。
	- 表示を維持したまま、不要な分岐やマジックナンバーを定数化する。

6. **検証サイクルの確立**
	- 各ステップ後に `npm run build` を実行し、UI 目視確認と合わせて差分が無いことを記録。
	- 必要に応じて log/refactoring.md に進捗と課題を追記する。

### 1. 依存関係の棚卸し（進行中）

- `src/main.ts`
	- 依存: `TexManager`, `UIManager`, `EffectManager`
	- 責務: p5 セットアップ、各マネージャの初期化と draw ループ制御。
- `src/core/texManager.ts`
	- 依存: `BPMManager`, `bandManager`, `APCMiniMK2Manager`, `ColorPalette`
	- 責務: メインシーン描画、MIDI パラメータ適用、バッファ管理。
- `src/core/uiManager.ts`
	- 依存: `TexManager`, `bandManager`, `EffectManager`（リソース参照）, p5 フォント/Graphics
	- 責務: UI 描画テクスチャ生成、パターン選択。
- `src/scenes/bandManager.ts`
	- 依存: `SevenSegmentDigit`, `bandGeometry` 系ユーティリティ, `UniformRandom`, `GVM`, `Easing`, `DateText`, `ColorPalette`
	- 責務: バンド描画と番号表示、各種モーション・配置制御。
- `src/core/effectManager.ts`
	- 依存: p5.Shader API
	- 責務: ポストエフェクト用シェーダのロードと uniform 設定。
- `public/shader/post.frag`
	- 依存 uniform: `u_tex`, `u_uiTex`, `u_captureTex`, `u_colorPalette`, fader/grid 系値
	- 責務: バッファ合成とポストエフェクト。

> 次ステップ: MIDI 関連 (`BPMManager`, `APCMiniMK2Manager`) や utils 配下の利用状況も引き続き整理して記録する。

- `src/rhythm/BPMManager.ts`
	- 依存: Web API (`performance.now`), console ログ
	- 責務: BPM 値の算出・更新、タップテンポ計算、ビート進行管理。
- `src/midi/apcmini_mk2/APCMiniMK2Manager.ts`
	- 依存: `MIDIManager` 基底クラス、ブラウザの MIDI/Keyboard イベント API
	- 責務: MIDI コントローラーおよびキーボードフォールバックの状態管理、グリッド/フェーダー値の更新、シーン切替。
- `src/utils/*`
	- `bandGeometry.ts`: トラペゾイド計算や頂点生成、バンド関連の幾何ヘルパー。
	- `colorPalette.ts`: 配列生成、RGB 変換、デフォルトパレット管理。
	- `dateText.ts`: 日付・時刻文字列生成。
	- `easing.ts`, `gvm.ts`: 補間やシェイプ関数、ノイズ生成などアニメーション補助。
	- `uniformRandom.ts`: シード付き乱数生成。
	- `characterChecker.ts`, `spaceText.ts`, `vertText.ts`: 現時点でコードからの参照は無いが、将来利用を見越した UI 文字処理ユーティリティ。ログでは宝物として保管方針を明記。
	- **TODO**: 主要ユーティリティのうち繰り返し利用しているもの（`bandGeometry`, `uniformRandom`, `easing`, `gvm` など）は後続ステップで `core/utils` のような共有モジュールとして整理案を検討。

- `src/scenes/components/SevenSegmentDisplay.ts`
	- 依存: `bandGeometry` の `AlignX` 型
	- 責務: 7セグメント数字描画ロジックの抽象化、セグメント毎の描画コールバック提供。
- `src/scenes/Scene.ts` / `src/types/Scene.ts`
	- 依存: 現時点でコメントアウト中の p5 型参照
	- 責務: シーン実装に対するインターフェースのプレースホルダ（実質未使用）。

> 次アクション: utils 内の「宝物」支援方針に沿って、頻出ユーティリティのモジュール化案を検討しつつ、`bandManager` の責務分割案を整理する。

### bandManager 分解メモ（2025-11-22）

- **現状把握**
	- 状態: 描画モード/バンド幅/中心位置など 5 系統のバンドパラメータ、数字表示に関する 6 系統のパラメータ、カラーパレットと 7 セグメント配列を内部保持。
	- 更新: `update` 内で MIDI パラメータ → 具体的なオプション配列へマッピング、ノイズ系ユーティリティを多用。
	- 描画: `draw` でループしながらバンド描画と 7 セグメント表示、配置・移動・回転ロジックを一括処理。

- **責務ごとの切り出し候補**
	1. **ParameterResolver**（仮）
		- 入力: raw MIDI 値（`bandParamValues`, `numberParamValues`）。
		- 出力: バンド描画設定、数字描画設定をまとめた構造体。
	2. **BandRenderer**
		- 入力: p5, tex, 事前計算済みオプション, カラーパレット。
		- 責務: `calculateSegmentBox` 周りの処理、`drawTrapezoidBand` 呼び出しを集中。
	3. **NumberDisplayController**
		- 入力: beat, セグメント配置設定。
		- 役割: `SevenSegmentDigit` の生成・管理、値決定、配置/動きの算出。

- **段階的実施案**
	1. `update` 部分をまずローカル関数で整理し、オプション配列と結果構造体を明示化。
	2. `draw` 内のループから、バンド描画と数値描画を別メソッドへ抽出（挙動変更なし）。
	3. 抽出したメソッドのうち再利用が見込まれるものを別クラス/ファイルに移行。
	4. いずれ `TexManager` から取得する情報をオブジェクト単位で受け渡す形に変更。

- **リスクと対策**
	- パラメータマッピングにノイズ/イージング関数が複数絡むため、変更時の挙動差分に要注意。
	- 7 セグメント描画は多岐に渡るスイッチ分岐があるため、先にテスト的にログや描画確認フラグを用意すると安全。

> 次ステップ案: `update` のパラメータマッピング部分をローカル構造体へ切り出し、挙動確認（コード変更前にユーザーへ共有予定）。

#### 実施記録 2025-11-22

- `bandManager.update` を `resolveParameters`（解決フェーズ）→ `applyBandParameters` / `applyNumberParameters`（適用フェーズ）に分割。
- 既存のオプション配列やマッピングロジックは構造体にまとめ、描画挙動は変更せずに整理。
- 今後の分離（ParameterResolver など）に備え、戻り値としてバンド設定・数字設定を明示的に切り分け。
- `draw` 内の1行処理を `createSegmentBoxForLine` / `drawBandForLine` / `drawNumberDisplay` に段階抽出し、既存描画振る舞いを維持したまま責務を整理。
- `drawNumberDisplay` の値決定・配置・移動/回転計算を `resolveNumberValue` などのヘルパー群へ整理し、1 メソッド内のネストを緩和しつつ描画結果を維持。
- 数値関連パラメータに対して `NumberValueType` などのリテラル型を導入し、`resolveParameters` のオプション配列も明示的に型付けしてミスアサインを防止。
- 数値表示ロジックを `NumberDisplayController` クラスとして `src/scenes/components/NumberDisplayController.ts` へ切り出し、`bandManager` からは生成したコントローラを呼び出すだけに整備。値決定や配置・モーションの分岐は新クラス側で担保。
- `bandManager` はパラメータ更新時にキャッシュを無効化し、描画ループで初アクセス時にコントローラを生成・再利用する遅延初期化フローへ変更し、無駄なインスタンス生成を抑制。
- `draw` では 1 フレームにつき 1 度だけコントローラを取得し、`drawNumberDisplay` に引き渡す構造に変更してループ内の `ensure` 呼び出しを解消。
- p5 インスタンスは `p`、意図的に未使用の引数は先頭 `_`、それ以外はキャメルケースを基準とするネーミング方針を確立。
- Scene インターフェースを `update(p, beat, bandParams, numberParams, colorPalette)` / `draw(p, target, beat)` の明示契約に更新し、`bandManager` と `TexManager` を新シグネチャへ追従。
- `BandManager` へクラス名を改名し、呼び出し元（`TexManager`/`UIManager`/`main.ts`）の型注釈と import を揃えた。

### MIDI リファクタリング計画（検討開始 2025-11-22）

- 既存実装は `MIDIManager` が初期化と send ヘルパーを提供し、`APCMiniMK2Manager` が 600 行超の状態管理・入出力処理を単一クラスで担当している。
- 入力処理: `handleMIDIMessage` に SHIFT トグル、フェーダーボタン、サイドボタン、グリッド、CC の分岐が集中。命名は概ね CamelCase だが、行列インデックスなどで追加説明コメントが必要。
- 出力処理: `midiOutputSendControls` でサイドボタン/グリッド/フェーダーボタンの LED を一括制御。定数やカラー定義は同一ファイルに混在。
- 補助ロジック: キーボードフォールバック、ランダムフェーダー、クランプ/乱数/時間取得など汎用ヘルパーが同ファイルに内包されており、テスト性が低い。
- **次アクション案**
	1. MIDI 入力・LED 出力・ランダムフェーダー・フォールバックを責務単位で分割する構造案を作成し、既存メソッド呼び出し順序を時系列で整理。
	2. `clamp01`/`clampGridSelection`/`simplePseudoRandom` などを `src/midi/utils.ts`（仮）に抽出し、ユニットテスト導入を見据えてフェーダー関連ロジックから切り離す。
	3. `handleMIDIMessage` を入力種別ごとの小メソッドへ分割し、命名規約に沿った引数名へ統一（例: `statusByte`, `noteNumber`, `velocity`).
	4. `midiOutputSendControls` の LED 更新をセクション別ヘルパーへ分け、カラー定数群を `const` オブジェクトとして util 化。
	5. キーボードフォールバックを専用クラスへ抽出し、MIDI 未接続時の初期化/解放を明示的に管理。
- 上記方針に沿って段階的に改修し、各ステップ後に `npm run build` と手動動作確認を実施予定。

#### 実施記録 2025-11-22

- `src/midi/utils.ts` を新設し、`clampGridSelection` / `clampUnitRange` / `pseudoRandomFromSeed` / `randomDurationInRange` / `getCurrentTimestamp` を共通化。
- `APCMiniMK2Manager` から上記ヘルパーを削除・移譲し、`NumericRange` 型でフェーダー乱数の範囲を明示。
- `update`・フォールバック処理・ランダムフェーダー更新で util を利用するよう書き換え、`processRandomFaders` での時刻取得も共通化。
- `handleMIDIMessage` を `handleShiftToggle` / `handleFaderButton` / `handleSideButton` / `handleGridPad` / `handleFaderControlChange` の分岐メソッドへ再構成し、可読性と今後の責務分離を容易にした。
- `midiOutputSendControls` を `sendSceneButtonLeds` / `sendGridPadLeds` / `sendFaderButtonLeds` へ分割し、LED カラー定義を `LED_COLORS` へ整理して視認性と保守性を向上。
- LED 送信処理を `sendNoteOn` ヘルパーへ集約し、LED 制御セクションの重複を削減。
- `update` からランダム値更新ループを `updateRandomGridValues` に抽出し、キーボードフォールバック通知も専用メソッドで一元化して処理フローを短縮。
- 未使用だったシーンランダム切替（Shift/F9/ランダムキー）処理を削除し、関連定数やメソッドを整理してコードをスリム化。
- `setMaxOptionsForScene` で 0 を許容し、該当カラムの LED・入力・ランダム状態を OFF に保つよう調整。MIDI 入力・フォールバックとも maxOptions=0 の列では操作が効果を持たないよう統一。

### UIManager 型整備（2025-11-22）

- `UIManager` 内部で `null` を使用していたレンダーテクスチャ参照を `undefined` ベースに更新。
- `UIDrawResources.captureTexture` も `undefined` 併用想定の型注釈へ調整。
- 未使用パラメータ警告を解消しつつ、描画挙動は従来どおり維持。

> 次の観察ポイント: `Scene` 実装や `SevenSegmentDigit` などコンポーネント層の依存、および utils 内で未利用のモジュールがないか洗う。

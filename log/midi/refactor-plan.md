# MIDI リファクタリング計画（2025-11-22）

## 現状整理

- `MIDIManager`
  - requestMIDIAccess の初期化、MIDI port の取得、送受信 callback セットを担当する基底クラス。
  - エラーハンドリングは console 出力と availability フラグのみ。
- `APCMiniMK2Manager`
   - 600 行超で入力・LED 出力・乱数制御まで一手に内包。
  - 定数（ノートレンジ、LED 色、キー割当など）がファイル先頭に固まっているが、機能別分類が無い。
  - `update` → `processRandomFaders` → `midiOutputSendControls` が毎フレーム呼ばれる。

## 課題

1. 入力処理
   - `handleMIDIMessage` がステータス毎に長大な if/else を持つ。
   - ベロシティやノート番号の命名が文脈依存（data1/data2）で読み解きづらい。
2. LED 出力
   - `midiOutputSendControls` でサイドボタン/グリッド/フェーダーを同時処理。
   - LED カラーが定数化されているが、責務別に分けられていない。
3. ランダムフェーダー
   - `activateRandomFader` 等が内部 state を直接操作し、副作用が複数箇所で発生。
   - 乱数処理や時間取得が manager 内に散在。
4. キーボードフォールバック
   - 未使用だったためコードから削除済み（今後の課題対象外）。
5. テスト難
   - util 化されていない関数 (clamp, random, timestamp) が多数。

## 分割案（フェーズ制）

### フェーズ 1: util 抽出（完了）
- `src/midi/utils.ts` に以下を移動：
  - clampGridSelection / clampUnitRange
  - pseudoRandomFromSeed / randomDurationInRange
  - getCurrentTimestamp
- APCMini から重複メソッドを削除して util を利用。

### フェーズ 2: 入力処理の再構成
- `handleMIDIMessage` を以下のメソッドへ分割：
  - `handleShiftToggle`
  - `handleFaderButton`
  - `handleSideButton`
  - `handleGridPad`
  - `handleFaderControlChange`
- データバイトの命名を `statusByte`, `noteNumber`, `velocity` 等へリネームし、コメントを削減。

### フェーズ 3: LED 出力パイプライン（完了）
- `midiOutputSendControls` をセクションごとに private メソッド化。（完了）
- LED カラー定数を `LED_COLORS` へ整理し、用途別に命名を調整。（完了）
- 送信処理を `sendNoteOn` ヘルパーに集約。（完了）

#### メモ（2025-11-22 更新）
- maxOptions=0 を許容し、該当列の MIDI 入力・LED 表示をすべて OFF にするガードを追加済み。ランダムシーンモード関連の未使用処理は削除済み。

### フェーズ 4: ランダムフェーダー（完了）
- `FaderRandomState` 管理を `RandomFaderController` に切り出し、値更新とモード切替を集約。（完了）
- `processRandomFaders` のロジックを controller 側へ移し、APCMini 側は委譲のみに整理。（完了）

### フェーズ 5: フォールバック入力（対応不要）
- キーボードフォールバック機能は未使用のためコードベースから削除済み。追加対応は不要。

### フェーズ 6: テストとドキュメント
- util への単体テスト導入を検討（Jest or Vitest）。
- README に MIDI 操作を整理予定（フォールバック手順は削除）。

import { createCn } from 'cn/config';

/**
 * globals.css の @theme に名前を付けた字の大きさを、字の大きさとして扱う cn。
 * そのままの cn は text-button のような名前を字の色と見なし、text-primary-foreground と重ねると
 * どちらかを消す（ボタンの字の色か大きさが消える）。名前の字の大きさと字の色を同じ cn に通す所ではこちらを使う。
 * globals.css に字の大きさを足したら、ここにも足す
 */
export const cn = createCn({
  extend: {
    theme: {
      text: [
        'page-title',
        'watermark',
        'button',
        'tab-label',
        'chart-axis',
        'legal-title',
        'legal-date',
        'legal-body',
      ],
    },
  },
});

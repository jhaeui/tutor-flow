"use client";

import { useState } from "react";

type PasteImageBoxProps = {
  name?: string;
  defaultValue?: string | null;
};

export default function PasteImageBox({ name = "photo_url", defaultValue = "" }: PasteImageBoxProps) {
  const [image, setImage] = useState(defaultValue || "");

  async function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const items = Array.from(event.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));

    if (!imageItem) return;

    event.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="md:col-span-3">
      <input type="hidden" name={name} value={image} />
      <div
        tabIndex={0}
        onPaste={handlePaste}
        className="min-h-24 cursor-text rounded-xl border border-dashed border-[#c9beb5] bg-white px-3 py-3 text-sm font-semibold text-[#525252] outline-none focus:ring-2 focus:ring-[#8d8177]"
      >
        {image ? (
          <div className="flex items-start gap-3">
            <img
              src={image}
              alt="붙여넣은 공지 사진"
              className="h-24 w-24 rounded-xl border border-[#e5e5e5] object-cover"
            />
            <div className="flex-1 text-xs leading-relaxed text-[#525252]">
              <p className="font-black text-[#171717]">사진 붙여넣기 완료</p>
              <p className="mt-1">다른 사진으로 바꾸려면 이 박스를 클릭하고 다시 Ctrl+V 하면 돼요.</p>
              <button
                type="button"
                onClick={() => setImage("")}
                className="mt-2 rounded-full border border-[#e5e5e5] bg-[#ffffff] px-3 py-1 text-xs font-black text-[#171717]"
              >
                사진 지우기
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-16 items-center justify-center text-center text-xs leading-relaxed">
            카톡 공지 사진을 복사한 뒤 여기를 클릭하고 Ctrl+V 해줘 .ᐟ .ᐟ
          </div>
        )}
      </div>
    </div>
  );
}

import Link from 'next/link';
import { useState } from 'react';

import { Panel } from '../../ui/Panel';
import { CreatorSectionForm } from './CreatorSectionForm';
import { ImageUploadField } from './ImageUploadField';
import { saveShopProfile, saveShopProfileImage } from './api';
import type { EditorCreatorProfile } from './types';

interface Props {
  initial: EditorCreatorProfile;
  nameLocked: boolean;
  profileImageUrl: string | null;
  /** 공개 상점 주소(경로). */
  shopPath: string;
}

/** 상점 콘솔의 프로필 — 사진 업로드(올리면 바로 저장)와 이름·소개·링크 폼. */
export function ShopProfilePanel({ initial, nameLocked, profileImageUrl, shopPath }: Props) {
  const [image, setImage] = useState(profileImageUrl ?? '');
  const [imageError, setImageError] = useState<string | null>(null);

  const onImage = async (url: string) => {
    setImageError(null);
    const result = await saveShopProfileImage(url);
    if (result.ok) setImage(url);
    else setImageError(result.message);
  };

  return (
    <div className="space-y-8">
      <Panel title="공개 상점 주소">
        <Link href={shopPath} className="break-all text-sm underline underline-offset-2">{`studionol.co.kr${shopPath}`}</Link>
      </Panel>
      <section aria-labelledby="shop-profile-image" className="space-y-3">
        <h2 id="shop-profile-image" className="typo-card-subtitle">프로필 사진</h2>
        <ImageUploadField uploadQuery="target=shop-profile" value={image} onChange={onImage} label="사진 올리기" hint="정사각형으로 잘려요." />
        {imageError && <p role="alert" className="typo-caption text-red-600 dark:text-red-400">{imageError}</p>}
      </section>
      <section aria-labelledby="shop-profile-info" className="space-y-3">
        <h2 id="shop-profile-info" className="typo-card-subtitle">소개</h2>
        <CreatorSectionForm initial={initial} readOnly={false} nameLocked={nameLocked} onSave={saveShopProfile} onSaved={() => undefined} />
      </section>
    </div>
  );
}

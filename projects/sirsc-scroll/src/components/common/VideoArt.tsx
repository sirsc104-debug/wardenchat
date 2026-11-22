import { memo, useState } from 'react';
import type { Video } from '../../state/types';
import { Placeholder } from '../placeholders/Placeholder';

/** A video's picture: YouTube's thumbnail for real videos, the animated placeholder for demo clips. */
export const VideoArt = memo(function VideoArt({ video, running, handle }: { video: Video; running: boolean; handle?: string }) {
  const [failed, setFailed] = useState(false);
  const url = video.source?.thumbnailUrl;
  if (url && !failed) {
    return (
      <div className={`yt-art${video.source?.orientation === 'horizontal' ? ' yt-art-wide' : ''}`} aria-hidden="true">
        <img src={url} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} />
      </div>
    );
  }
  return <Placeholder video={video} running={running} handle={handle} />;
});

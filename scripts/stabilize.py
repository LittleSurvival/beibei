from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import cv2 as cv
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
W, H = 480, 640
# Use one viewport in the reference image's coordinates for every photo.
CROP_CENTER = np.array([230, 320])
CROP_ZOOM = 1.65
cv.setNumThreads(1)
records = json.loads((ROOT/'content/days.json').read_text())
photos = ROOT/'fangyi-timelapse/photos'

def load(row):
    image = cv.imread(str(photos/row['image']), cv.IMREAD_GRAYSCALE)
    return cv.resize(image, (W,H))

def describe(gray, fixed=False):
    mask = np.full(gray.shape, 255, np.uint8)
    if fixed:
        mask[200:475, 175:310] = 0
    mask[:14] = mask[-14:] = mask[:, :14] = mask[:, -14:] = 0
    normalized = cv.createCLAHE(clipLimit=2.5,tileGridSize=(8,8)).apply(gray)
    points, features = cv.SIFT_create(nfeatures=2000, contrastThreshold=.018).detectAndCompute(normalized,mask)
    return np.float32([p.pt for p in points]), features

def match(src,dst):
    p,d=src
    q,e=dst
    if d is None or e is None: return None
    matches=cv.BFMatcher().knnMatch(d,e,k=2)
    good=[m for m,n in matches if m.distance < .73*n.distance]
    if len(good)<8:return None
    a=np.float32([p[m.queryIdx] for m in good]);b=np.float32([q[m.trainIdx] for m in good])
    matrix, mask=cv.estimateAffinePartial2D(a,b,method=cv.RANSAC,ransacReprojThreshold=3,maxIters=3500,confidence=.998)
    if matrix is None:return None
    inlier=mask.ravel().astype(bool)
    count=int(inlier.sum())
    coverage=cv.contourArea(cv.convexHull(b[inlier]))/(W*H) if count>=3 else 0
    angle=np.degrees(np.arctan2(matrix[1,0],matrix[0,0]))
    scale=np.hypot(*matrix[:,0])
    center=matrix @ [W/2,H/2,1]
    if count<8 or coverage<.015 or not (.45<scale<2.1) or abs(angle)>32 or np.linalg.norm(center-[W/2,H/2])>195:return None
    return count*min(coverage/.11,1), count, coverage, matrix

def process(row):
    gray=load(row)
    raw=describe(gray)
    candidates=[]
    for ref, world in anchors:
        result=match(raw,ref)
        if result:
            score,count,coverage,matrix=result
            candidates.append((score,count,coverage,world @ np.vstack([matrix,[0,0,1]])))
        if candidates and candidates[0][0] >= 100: break
    if not candidates:
        return row['day'], None, 0, 0
    _,count,coverage,matrix=max(candidates,key=lambda r:r[0])
    return row['day'], matrix[:2].tolist(), count, round(coverage,3)


# Manually located the roof edge in photos with weak matches or unusual framing.
# Coordinates refer to a 240 x 320 review image. Negative scale corrects Day 380's rotation.
manual = {
    2: (140, 122, .94), 46: (129, 126, .86), 220: (129, 125, .91),
    259: (132, 107, .85), 290: (127, 121, .96), 365: (141, 177, 1.35),
    380: (108, 208, -1.02), 454: (162, 111, .91), 745: (132, 87, .63),
}

def crop_matrix(matrix):
    frame = matrix * CROP_ZOOM
    frame[:, 2] += np.array([W / 2, H / 2]) - CROP_CENTER * CROP_ZOOM
    return np.round(frame, 5).flatten().tolist()

def export(results):
    matrices = {}
    for day, matrix, _, _ in results:
        if day in manual:
            x, y, scale = manual[day]
            matrix = [[scale, 0, 253 - 2*scale*x], [0, scale, 234 - 2*scale*y]]
        if matrix is not None:
            matrices[str(day)] = crop_matrix(np.array(matrix))
    output = ROOT / 'content/stabilization.json'
    output.write_text('{\n' + ',\n'.join(
        f'  {json.dumps(day)}: {json.dumps(matrix)}' for day, matrix in matrices.items()
    ) + '\n}\n', encoding='utf-8')
    print(f'Wrote {len(matrices)} of {len(results)} alignments')

if __name__ == '__main__':
    by_day={r['day']:r for r in records}
    reference=describe(load(by_day[971]),True)
    anchors=[(reference,np.eye(3))]
    for day in [15,102,176,226,325,425,520,640,738,815,889,937]:
        gray=load(by_day[day])
        result=match(describe(gray),reference)
        if result and result[0]>=17:
            anchors.append((describe(gray,True),np.vstack([result[3],[0,0,1]])))
            print('anchor',day,round(result[0],1),flush=True)
    with ThreadPoolExecutor(max_workers=6) as pool:
        results=[]
        for result in pool.map(process,records):
            results.append(result)
            if len(results)%100==0: print('matched',len(results),flush=True)
    export(results)

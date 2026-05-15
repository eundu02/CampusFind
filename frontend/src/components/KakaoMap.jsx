import { useEffect, useRef } from "react";

function KakaoMap() {
  const mapRef = useRef(null);

  useEffect(() => {
    const waitForKakao = setInterval(() => {
      if (window.kakao && window.kakao.maps) {
        clearInterval(waitForKakao);

        window.kakao.maps.load(() => {
          const options = {
            center: new window.kakao.maps.LatLng(35.8622, 129.1951),
            level: 3,
          };

          const map = new window.kakao.maps.Map(
            mapRef.current,
            options
          );

          console.log("카카오 지도 생성 완료");

          let marker = null;

          window.kakao.maps.event.addListener(
            map,
            "click",
            function (mouseEvent) {
              const latlng = mouseEvent.latLng;

              const latitude = latlng.getLat();
              const longitude = latlng.getLng();

              console.log("위도:", latitude);
              console.log("경도:", longitude);

              if (marker) {
                marker.setMap(null);
              }

              marker = new window.kakao.maps.Marker({
                position: latlng,
              });

              marker.setMap(map);
            }
          );
        });
      }
    }, 100);

    return () => clearInterval(waitForKakao);
  }, []);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "500px",
      }}
    />
  );
}

export default KakaoMap;
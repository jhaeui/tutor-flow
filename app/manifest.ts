import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tutor Flow",
    short_name: "Tutor Flow",
    description: "수업, 숙제, 시험범위, 일정 관리를 위한 튜터링 대시보드",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    orientation: "portrait-primary",
  };
}

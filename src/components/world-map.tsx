// @ts-nocheck
"use client"

import { memo, useMemo } from "react"
import { motion } from "framer-motion"
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Graticule,
  Sphere
} from "react-simple-maps"
import type { TrendingTopic } from "@/lib/types"

// We use a reliable TopoJSON file for accurate world boundaries.
// This is widely used with react-simple-maps.
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

// Real-world city coordinates for each news category: [longitude, latitude]
const HOTSPOT_MAP: Record<string, { coordinates: [number, number]; label: string }[]> = {
  tech:    [{ coordinates: [-122.1, 37.4], label: "Silicon Valley" }, { coordinates: [103.8, 1.3], label: "Singapore"  }, { coordinates: [-0.1, 51.5],  label: "London"     }],
  finance: [{ coordinates: [-74.0, 40.7],  label: "New York"       }, { coordinates: [-0.1, 51.5], label: "London"     }, { coordinates: [139.7, 35.7], label: "Tokyo"       }],
  policy:  [{ coordinates: [-77.0, 38.9],  label: "Washington DC"  }, { coordinates: [4.4, 50.8],  label: "Brussels"   }, { coordinates: [37.6, 55.8],  label: "Moscow"      }],
  geo:     [{ coordinates: [44.4, 33.3],   label: "Baghdad"        }, { coordinates: [35.2, 31.8], label: "Jerusalem"  }, { coordinates: [55.3, 25.2],  label: "Dubai"       }],
  social:  [{ coordinates: [-122.4, 37.8], label: "San Francisco"  }, { coordinates: [151.2, -33.9], label: "Sydney"   }, { coordinates: [2.3, 48.9],   label: "Paris"       }],
}

const NATION_COORDS: Record<string, [number, number]> = {
  "India": [78.96, 20.59], "Kashmir": [74.79, 34.08], "Delhi": [77.20, 28.61], "Mumbai": [72.87, 19.07],
  "USA": [-95.71, 37.09], "US": [-95.71, 37.09], "America": [-95.71, 37.09], "Washington": [-77.03, 38.89], "New York": [-74.00, 40.71],
  "China": [104.19, 35.86], "Beijing": [116.40, 39.90], "Taiwan": [120.96, 23.69],
  "Russia": [105.31, 61.52], "Moscow": [37.61, 55.75],
  "Ukraine": [31.16, 48.37], "Kyiv": [30.52, 50.45],
  "Israel": [34.85, 31.04], "Jerusalem": [35.21, 31.76], "Gaza": [34.46, 31.50],
  "Iran": [53.68, 32.42], "Tehran": [51.38, 35.68],
  "UK": [-3.43, 55.37], "London": [-0.12, 51.50],
  "Europe": [15.25, 54.52], "EU": [4.40, 50.85],
  "Japan": [138.25, 36.20], "Tokyo": [139.69, 35.68],
  "Korea": [127.76, 35.90], "Seoul": [126.97, 37.56],
  "Australia": [133.77, -25.27], "Sydney": [151.20, -33.86],
  "France": [2.21, 46.22], "Paris": [2.35, 48.85],
  "Germany": [10.45, 51.16], "Berlin": [13.40, 52.52],
  "Canada": [-106.34, 56.13], "Toronto": [-79.38, 43.65],
  "Brazil": [-51.92, -14.23], "Mexico": [-102.55, 23.63],
  "Africa": [21.09, 7.18], "South Africa": [22.93, -30.55],
  "Egypt": [30.80, 26.82], "Saudi Arabia": [45.07, 23.88], "UAE": [53.84, 23.42], "Dubai": [55.27, 25.20],
}

function extractLocations(text: string): { coordinates: [number, number]; label: string }[] {
  const found: { coordinates: [number, number]; label: string }[] = []
  for (const [loc, coords] of Object.entries(NATION_COORDS)) {
    if (new RegExp(`\\b${loc}\\b`, 'i').test(text)) {
      found.push({ coordinates: coords, label: loc })
    }
  }
  // If "US" and "USA" both match, deduplicate (or just let the set handle it later)
  return found
}

interface WorldMapProps {
  topics?: TrendingTopic[]
  category?: string
  size?: "small" | "large"
  highlightBySentiment?: boolean
}

function WorldMapBase({ topics, category, size = "small", highlightBySentiment = false }: WorldMapProps) {
  // Aggregate hotspots from active topics
  const hotspots = useMemo(() => {
    const raw: { coordinates: [number, number]; label: string; color: string; urgency?: string }[] = []

    if (topics) {
      topics.forEach((topic) => {
        let spots = extractLocations(topic.topic + " " + (topic.impact || ""))
        if (spots.length === 0) {
          spots = HOTSPOT_MAP[topic.category] ?? HOTSPOT_MAP.geo
        } else if (spots.length > 2) {
          spots = spots.slice(0, 2)
        }

        const color = topic.sentimentScore > 0 ? "#22c55e" : topic.sentimentScore < -30 ? "#ef4444" : "#ccff00"
        spots.forEach((spot) => {
          raw.push({ ...spot, color: highlightBySentiment ? color : "#ef4444", urgency: topic.urgency })
        })
      })
    } else if (category) {
      const spots = HOTSPOT_MAP[category] ?? HOTSPOT_MAP.geo
      spots.forEach((spot) => {
        raw.push({ ...spot, color: "#ef4444" })
      })
    }

    // Deduplicate by label so we don't stack markers infinitely
    const seen = new Set<string>()
    return raw.filter((h) => {
      if (seen.has(h.label)) return false
      seen.add(h.label)
      return true
    })
  }, [topics, category, highlightBySentiment])

  const pulseR = size === "large" ? 14 : 9

  return (
    <div style={{
      position: "relative",
      borderRadius: size === "large" ? 14 : 10,
      overflow: "hidden",
      background: "#06111f",
      border: "1px solid #1a2d42",
      width: "100%",
    }}>
      <ComposableMap
        projectionConfig={{ scale: 140 }}
        width={800}
        height={400}
        style={{ width: "100%", height: "auto" }}
      >
        {/* Ocean Graticule & Sphere */}
        <Sphere fill="#06111f" stroke="none" strokeWidth={0.5} id="sphere" />
        <Graticule stroke="#0f2035" strokeWidth={0.5} />

        {/* Real World Geometry */}
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#112233"
                stroke="#1e3f5a"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { fill: "#1a314b", outline: "none", transition: "all 250ms" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {/* Dynamic Event Markers */}
        {hotspots.map((spot, i) => {
          const isBreaking = spot.urgency === "breaking"
          const r = isBreaking ? pulseR + 4 : pulseR

          return (
            <Marker key={`${spot.label}-${i}`} coordinates={spot.coordinates}>
              {/* Outer Ripple */}
              <motion.circle
                r={2}
                fill="none"
                stroke={spot.color}
                strokeWidth={1.5}
                animate={{ r: [2, r], opacity: [0.8, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.35, ease: "easeOut" }}
              />
              {/* Inner Ripple */}
              <motion.circle
                r={2}
                fill="none"
                stroke={spot.color}
                strokeWidth={1}
                animate={{ r: [2, r * 0.65], opacity: [0.6, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.35 + 0.6, ease: "easeOut" }}
              />
              {/* Glow Blur */}
              <motion.circle
                r={4}
                fill={spot.color}
                opacity={0.2}
                animate={{ r: [3, 6, 3], opacity: [0.15, 0.3, 0.15] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
              />
              {/* Core Solid Dot */}
              <motion.circle
                r={2.5}
                fill={spot.color}
                animate={{ opacity: [1, 0.7, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
              />
            </Marker>
          )
        })}
      </ComposableMap>

      {/* Floating Labels Legend */}
      {hotspots.length > 0 && (
        <div style={{
          position: "absolute", bottom: 8, left: 10,
          display: "flex", gap: 8, flexWrap: "wrap",
          pointerEvents: "none" // allow clicking through to map if needed later
        }}>
          {hotspots.slice(0, size === "large" ? 20 : 4).map((spot, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 4,
              fontSize: size === "large" ? 11 : 9,
              color: spot.color, fontWeight: 700,
              background: "rgba(6,17,31,0.85)", padding: "2px 8px", borderRadius: 999,
              backdropFilter: "blur(4px)",
              border: `1px solid ${spot.color}33`,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: spot.color, boxShadow: `0 0 4px ${spot.color}` }} />
              {spot.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Memoized to prevent heavy re-renders of the topojson data
export const WorldMap = memo(WorldMapBase)

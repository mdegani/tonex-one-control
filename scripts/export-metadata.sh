#!/bin/bash
# Export preset metadata from a running Tonex Editor instance.
# Usage: ./scripts/export-metadata.sh > presets.tsv
#
# Then import presets.tsv in OneTweak: Settings > Preset Metadata > Import File

osascript -e '
tell application "System Events"
    tell process "TONEX Editor"
        set theRows to every row of outline 1 of window 1
        set output to ""
        repeat with r in theRows
            set cells to every UI element of r
            set rowText to ""
            repeat with c in cells
                try
                    set v to value of c
                    if v is not missing value then set rowText to rowText & v & tab
                end try
            end repeat
            if rowText is not "" then set output to output & rowText & linefeed
        end repeat
        return output
    end tell
end tell'

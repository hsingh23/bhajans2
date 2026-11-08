// Language (lg) and deity (d) tags. A song that mixes two languages, or sings to two
// deities, has a second tag (lg2 / d2): it matches and counts under both.
export const hasTag = (item, key, value) => item?.[key] === value || item?.[`${key}2`] === value;

export const countBy = (items, key) =>
  items.reduce((counts, item) => {
    for (const value of new Set([item?.[key], item?.[`${key}2`]])) {
      if (value) counts[value] = (counts[value] || 0) + 1;
    }
    return counts;
  }, {});

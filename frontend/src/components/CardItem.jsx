export default function CardItem({ card, quantity, onQuantityChange }) {
  const state =
    quantity === undefined ? 'none' :
    quantity === 0 ? 'needed' :
    quantity === 1 ? 'have_one' : 'doubles';

  const handleClick = (e) => {
    if (e.target.closest('.doubles-ctrl')) return;
    if (state === 'none') onQuantityChange(0);
    else if (state === 'needed') onQuantityChange(1);
    else if (state === 'have_one') onQuantityChange(2);
    else onQuantityChange(undefined);
  };

  const inc = (e) => {
    e.stopPropagation();
    onQuantityChange(quantity + 1);
  };

  const dec = (e) => {
    e.stopPropagation();
    onQuantityChange(quantity > 2 ? quantity - 1 : 1);
  };

  const specialClass = card.is_special ? ' card-special' : '';

  return (
    <div
      className={`card-item card-${state}${specialClass}`}
      onClick={handleClick}
      title={`#${card.number}${card.is_special ? ' ★' : ''} — ${card.name}`}
    >
      <span className="card-num">{card.number}</span>
      {card.is_special && state === 'none' && <span className="special-star">★</span>}
      {state === 'doubles' && (
        <div className="doubles-ctrl">
          <button onClick={dec}>−</button>
          <span>×{quantity}</span>
          <button onClick={inc}>+</button>
        </div>
      )}
    </div>
  );
}

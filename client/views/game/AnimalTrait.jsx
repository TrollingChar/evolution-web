import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';
import classnames from 'classnames';

import {GameProvider} from './providers/GameProvider.jsx';

import { DragSource } from 'react-dnd';
import { DND_ITEM_TYPE } from './dnd/DND_ITEM_TYPE';

import { TraitModel } from '~/shared/models/game/evolution/TraitModel';

class _AnimalTrait extends React.Component {
  static defaultProps = {
    isUserTurn: false
  };

  static propTypes = {
    trait: React.PropTypes.instanceOf(TraitModel).isRequired
    , owner: React.PropTypes.object
    , index: React.PropTypes.number.isRequired
    , isUserTurn: React.PropTypes.bool.isRequired
  };

  constructor(props) {
    super(props);
    this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);
  }

  render() {
    const {trait, index, isUserTurn, connectDragSource, isDragging} = this.props;

    const className = classnames({
      AnimalTrait: true
      , disabled: !isUserTurn
      , enabled: isUserTurn
      , isDragging: isDragging
    });

    const body = <div className={className} style={{top: `-${(index + 1) * 1.6}em`}}>{trait.type.replace('Trait', '')}</div>;

    return connectDragSource ? connectDragSource(body) : body;
  }
}

const _DraggableAnimalTrait = DragSource(DND_ITEM_TYPE.TRAIT
  , {
    beginDrag: (props) => ({trait: props.trait, owner: props.owner})
    , canDrag: (props, monitor) => props.isUserTurn && props.trait.dataModel.checkAction(props.game, props.owner)
  }
  , (connect, monitor) => ({
    connectDragSource: connect.dragSource()
    , isDragging: monitor.isDragging()
  })
)(_AnimalTrait);

export const DraggableAnimalTrait = GameProvider(_DraggableAnimalTrait);
export const AnimalTrait = GameProvider(_AnimalTrait);
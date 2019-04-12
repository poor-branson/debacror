import Component from 'vue-class-component';
import { communicator, Storage } from '../../util';

@Component({
  props: {
    statu: String,
    allowShot: {
      type: Boolean,
      default: false,
    },
    allowClear: {
      type: Boolean,
      default: false,
    },
  },
})
export default class CentralButton {
  openCollapse = false;

  get icon() {
    const statuMapper = {
      pause: 'play-circle',
      record: 'pause-circle',
      reload: 'redo',
    };

    return statuMapper[this.statu];
  }

  showSaveForm() {
    if (!this.allowShot) return;
    this.openCollapse = !this.openCollapse;
  }

  createSnapshot() {
    communicator.toBackground({
      action: 'CREATE_SNAPSHOT'
    });
  }

  toggleRecord() {
    switch (this.statu) {
      case 'pause':
        this.$emit('start');
        break;
      case 'record':
        this.$emit('pause');
        break;
      case 'reload':
        this.$emit('reload');
        break;
    }
  }

  async view() {
    const listStore = new Storage({ namespace: 'SNAPSHOT_NAME_LIST' });
    const list = (await listStore.get('all')) || [];
    list.map(async item => {
      const store = new Storage({ namespace: item });
      const d = await store.get();
      console.log(d);
    });
  }

  render() {
    return (
      <section>
        <div class="buttons has-addons is-centered">
          <a class="button" onClick={this.toggleRecord}>
            <b-tooltip
              active={this.statu === 'reload'}
              label="this page need to reload."
              position="is-bottom"
              always
            >
              <b-icon size="is-small" pack="fas" icon={this.icon} />
              <span>Record</span>
            </b-tooltip>
          </a>
          <a
            class={{ button: true, 'is-primary': this.openCollapse }}
            onClick={this.showSaveForm}
            disabled={!this.allowShot}
          >
            <b-icon size="is-small" pack="fas" icon="camera" />
            <span>Shot</span>
          </a>
          <a class="button" disabled={!this.allowClear}>
            <span class="icon is-small">
              <i class="fas fa-broom" />
            </span>
            <span>Clear</span>
          </a>
          <a class="button" onClick={this.view}>view</a>
        </div>
        <b-collapse open={this.openCollapse}>
          <b-field position="is-centered">
            <b-input
              placeholder="Description..."
              type="search"
              icon="info"
              icon-pack="fas"
            />
            <p class="control">
              <button class="button is-primary" onClick={this.createSnapshot}>save</button>
            </p>
          </b-field>
        </b-collapse>
      </section>
    );
  }
}
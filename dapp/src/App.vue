<template>
    <section style="height: 100%;">
        <nav class="navbar is-transparent container py-3" role="navigation" aria-label="main navigation">
            <div class="navbar-brand">
                <b-navbar-item href="https://www.edennetwork.io" target="_blank">
                        <img src="@/assets/head-logo.png" alt="Eden Logo" />
                </b-navbar-item>

                <a 
                    role="button" 
                    @click="showNav = !showNav"
                    class="navbar-burger"
                    :class="{ 'is-active': showNav }"
                    aria-label="menu" 
                    aria-expanded="false" 
                    v-if="account"
                >
                    <span aria-hidden="true"></span>
                    <span aria-hidden="true"></span>
                    <span aria-hidden="true"></span>
                </a>
            </div>
            <div class="navbar-menu" :class="{ 'is-active': showNav }" v-if="account">
                <div class="navbar-start">
                    <b-navbar-item tag="router-link" :to="{ name: 'Staking' }">
                        Staking
                    </b-navbar-item>
                    <b-navbar-item tag="router-link" :to="{ name: 'Vesting' }">
                        Vesting
                    </b-navbar-item>
                    <b-navbar-item href="https://gov.edennetwork.io" target="_blank">
                        <span>Voting</span>
                        <span class="icon is-medium ml-1">
                            <i class="mdi mdi-arrow-top-right"></i>
                        </span>
                    </b-navbar-item>
                    <b-navbar-item tag="router-link" :to="{ name: 'VestingAdmin' }" v-if="accountAdmin">
                        Admin Panel
                    </b-navbar-item>
                </div>

                <div class="navbar-end">
                    <div class="navbar-item" v-if="account">
                        <b-button rounded type="is-primary" tag="router-link" :to="{name: 'Home'}">
                            <span class="icon">
                                <i class="mdi mdi-ethereum"></i>
                            </span>
                            <span>
                                {{ account | shortEth }}
                            </span>
                        </b-button>
                    </div>
                </div>
            </div>
        </nav>

        <router-view></router-view>

        <footer class="footer">
            <div class="content has-text-centered">
                <p>&nbsp;</p>
            </div>
        </footer>

        <nav class="navbar is-fixed-bottom is-transparent is-hidden-mobile">
            <div class="container py-3 is-flex is-justify-between">
                <div class="navbar-end">
                    <b-navbar-item class="is-family-secondary" href="https://github.com/edennetwork/governance" target="_blank">
                        <span class="icon is-medium">
                            <i class="mdi mdi-github"></i>
                        </span>
                        Github
                    </b-navbar-item>
                    <b-navbar-item class="is-family-secondary" href="https://twitter.com/Eden_DAO" target="_blank">
                        <span class="icon is-medium">
                            <i class="mdi mdi-twitter"></i>
                        </span>
                        Twitter
                    </b-navbar-item>
                    <b-navbar-item class="is-family-secondary" href="https://discord.gg/98GV73f" target="_blank">
                        <span class="icon is-medium">
                            <i class="mdi mdi-discord"></i>
                        </span>
                        Discord
                    </b-navbar-item>
                </div>
            </div>
        </nav>
    </section>
</template>

<script>
  import {mapGetters} from 'vuex';

  export default {
    components: {},
    computed: mapGetters(['account', 'accountAdmin']),
    methods: {
      async backToHome() {
        await this.$store.dispatch('disconnect');
        return this.$router.push({name: 'Home'});
      },
    },
    data() {
        return {
            showNav: false
        }
    },
    mounted() {
      if (
          this.$router.currentRoute.path === '/staking' ||
          this.$router.currentRoute.path === '/vesting' || 
          this.$router.currentRoute.path === '/vesting-admin'
        ) {
        this.$router.push({name: 'Home'});
      }
    },
  };
</script>

<style lang="scss">

    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700&family=Open+Sans;&display=swap');

    // Eden colors
    $eden-background: #11141c;
    $eden-primary-green: #6ab04c;
    $eden-primary-purple: #5545bf;
    $eden-primary-cyan: #00cec9;
    $eden-primary-orange: #fdcb6e;
    $eden-secondary-silver: #DEDBFF;
    $eden-secondary-gray: #303642;
    $eden-secondary-red: #E17055;
    $eden-helper-box: #151926;

    $white: #fff;
    $dark: $eden-background;
    $background: $eden-background;
    $footer-background-color: $eden-background;

    $family-primary: "Montserrat", BlinkMacSystemFont, -apple-system, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", "Helvetica", "Arial", sans-serif;
    $family-secondary: "Open Sans", BlinkMacSystemFont, -apple-system, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", "Helvetica", "Arial", sans-serif;

    $primary: $eden-primary-purple;
    $link: $eden-primary-green;
    $success: $eden-primary-green;
    $info: $eden-primary-cyan;
    $warning: $eden-primary-orange;
    $danger: $eden-secondary-red;

    $text: $eden-secondary-silver;
    $text-light: $eden-secondary-gray;
    $text-strong: $eden-secondary-silver;

    $button-text-decoration: "none";
    $button-text-hover-background-color: $eden-helper-box;
    $button-text-hover-color: $link;

    $input-border-color: $eden-background;
    $input-hover-border-color: $eden-background;
    $input-focus-border-color: $text;

    $weight-normal: 500;
    $weight-semibold: 700;

    $size-1: 4rem;

    $box-background-color: $eden-helper-box;
    $box-shadow: -8px 0 8px 0 #3f3f3f38, 8px 0 8x 0 #d0d0d038;

    $navbar-item-hover-background-color: transparent;
    $navbar-fixed-z: 0;
    $navbar-z: 0;

    $scheme-main: $eden-background;

    @import "~bulma/sass/utilities/_all";
    @import '~bulma';
    @import "~buefy/src/scss/buefy";
</style>
